import crypto from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, products } from "@/db/schema";
import { ApiError, assertUuid, decimal } from "@/lib/apiError";
import { createInvoice } from "@/services/invoice";
import { logAuditEvent } from "@/services/audit";

export interface OrderInput {
  requestKey?: string;
  requestHash?: string;
  customerId: string;
  projectId?: string | null;
  employeeId?: string | null;
  deliveryDate?: Date | null;
  notes?: string | null;
  createdById?: string;
  items: Array<{ productId: string; quantity: number; unitPrice?: number; notes?: string }>;
}

function validateInput(input: OrderInput) {
  assertUuid(input.customerId);
  if (input.projectId) assertUuid(input.projectId);
  if (input.employeeId) assertUuid(input.employeeId);
  if (!Array.isArray(input.items) || input.items.length === 0) throw new ApiError(400, "حداقل یک محصول برای سفارش الزامی است.");
  if (input.items.length > 500) throw new ApiError(400, "حداکثر ۵۰۰ ردیف در هر سفارش مجاز است.");
  for (const item of input.items) {
    assertUuid(item.productId);
    const quantity = Number(decimal(item.quantity, "تعداد سفارش", 4, true));
    if (quantity <= 0) throw new ApiError(400, "تعداد سفارش باید بیشتر از صفر باشد.");
    if (item.unitPrice !== undefined && Number(decimal(item.unitPrice, "قیمت سفارش", 2)) < 0) throw new ApiError(400, "قیمت سفارش نامعتبر است.");
  }
}

export async function createOrder(input: OrderInput) {
  validateInput(input);
  return db.transaction(async (tx) => {
    if (input.requestKey) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestKey}, 0))`);
      const [prior] = await tx.select().from(orders).where(eq(orders.requestKey, input.requestKey)).limit(1);
      if (prior) {
        if (prior.requestHash !== input.requestHash) throw new ApiError(409, "این کلید درخواست قبلاً با اطلاعات دیگری استفاده شده است.");
        return prior;
      }
    }
    const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) throw new ApiError(404, "مشتری سفارش یافت نشد.");
    const productIds = Array.from(new Set(input.items.map((item) => item.productId)));
    const catalog = await tx.select().from(products).where(and(inArray(products.id, productIds), eq(products.status, "active"))).for("update");
    if (catalog.length !== productIds.length) throw new ApiError(400, "یک یا چند محصول سفارش فعال یا معتبر نیست.");
    const productById = new Map(catalog.map((product) => [product.id, product]));
    const ready = input.items.every((item) => Number(productById.get(item.productId)!.stockQuantity) >= Number(item.quantity));
    const [order] = await tx.insert(orders).values({
      requestKey: input.requestKey,
      requestHash: input.requestHash,
      orderNumber: `ORD-${crypto.randomUUID()}`,
      customerId: input.customerId,
      projectId: input.projectId || null,
      employeeId: input.employeeId || null,
      status: ready ? "ready" : "open",
      deliveryDate: input.deliveryDate || null,
      notes: input.notes?.trim() || null,
      createdById: input.createdById || "system_user",
    }).returning();
    await tx.insert(orderItems).values(input.items.map((item) => {
      const product = productById.get(item.productId)!;
      return {
        orderId: order.id,
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: Number(item.quantity).toString(),
        unitPriceSnapshot: Number(item.unitPrice ?? product.basePrice).toString(),
        notes: item.notes?.trim() || null,
      };
    }));
    await logAuditEvent("ORDER_CREATE", "order", order.id, { orderNumber: order.orderNumber, customerId: order.customerId, itemCount: input.items.length }, undefined, tx);
    return order;
  });
}

export async function cancelOrder(orderId: string, reason?: string) {
  assertUuid(orderId);
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    if (order.status === "converted") throw new ApiError(409, "سفارش تبدیل‌شده قابل لغو نیست.");
    if (order.status === "cancelled") return order;
    const [updated] = await tx.update(orders).set({ status: "cancelled", notes: reason?.trim() || order.notes, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    await logAuditEvent("ORDER_CANCEL", "order", order.id, { orderNumber: order.orderNumber, reason: reason || null }, undefined, tx);
    return updated;
  });
}

export async function convertOrderToInvoice(orderId: string, actorId: string) {
  assertUuid(orderId);
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    if (order.status === "converted") throw new ApiError(409, "این سفارش قبلاً به فاکتور تبدیل شده است.");
    if (order.status === "cancelled") throw new ApiError(409, "سفارش لغوشده قابل تبدیل نیست.");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    if (!items.length) throw new ApiError(409, "سفارش بدون قلم قابل تبدیل نیست.");
    const invoice = await createInvoice({
      requestKey: `order-convert:${order.id}`,
      requestHash: order.updatedAt.toISOString(),
      customerId: order.customerId,
      projectId: order.projectId,
      employeeId: order.employeeId,
      salesMode: order.employeeId ? "visitor" : "direct",
      invoiceDate: new Date(),
      items: items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unitPrice: Number(item.unitPriceSnapshot) })),
      notes: [order.notes, `تبدیل‌شده از سفارش ${order.orderNumber}`].filter(Boolean).join(" - "),
    }, tx);
    await tx.update(orders).set({ status: "converted", convertedInvoiceId: invoice.id, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await logAuditEvent("ORDER_CONVERT", "order", order.id, { orderNumber: order.orderNumber, invoiceId: invoice.id, actorId }, undefined, tx);
    return invoice;
  });
}
