import crypto from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, products } from "@/db/schema";
import { ApiError, assertUuid, decimal } from "@/lib/apiError";
import { createInvoice, type CreateInvoiceInput } from "@/services/invoice";
import { AuditContext, logAuditEvent } from "@/services/audit";

export interface OrderInput {
  requestKey?: string;
  requestHash?: string;
  customerId: string;
  projectId?: string | null;
  employeeId?: string | null;
  deliveryDate?: Date | null;
  validUntil?: Date | null;
  deliveryAddress?: string | null;
  paymentTerms?: string | null;
  invoiceDiscount?: number;
  notes?: string | null;
  createdById?: string;
  items: Array<{ productId?: string | null; productName?: string; quantity: number; unitPrice?: number; discountAmount?: number; notes?: string }>;
}

function validateInput(input: OrderInput) {
  assertUuid(input.customerId);
  if (input.projectId) assertUuid(input.projectId);
  if (input.employeeId) assertUuid(input.employeeId);
  if (!Array.isArray(input.items) || input.items.length === 0) throw new ApiError(400, "حداقل یک محصول برای سفارش الزامی است.");
  if (input.items.length > 500) throw new ApiError(400, "حداکثر ۵۰۰ ردیف در هر سفارش مجاز است.");
  for (const item of input.items) {
    if (item.productId) assertUuid(item.productId);
    else if (!item.productName?.trim()) throw new ApiError(400, "عنوان قلم دستی الزامی است.");
    const quantity = Number(decimal(item.quantity, "تعداد سفارش", 4, true));
    if (quantity <= 0) throw new ApiError(400, "تعداد سفارش باید بیشتر از صفر باشد.");
    if (item.unitPrice !== undefined && Number(decimal(item.unitPrice, "قیمت سفارش", 2)) < 0) throw new ApiError(400, "قیمت سفارش نامعتبر است.");
    const discount = Number(decimal(item.discountAmount ?? 0, "تخفیف ردیف"));
    if (item.unitPrice !== undefined && discount > quantity * Number(item.unitPrice)) throw new ApiError(400, "تخفیف ردیف از مبلغ آن بیشتر است.");
  }
  decimal(input.invoiceDiscount ?? 0, "تخفیف کل");
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
    const productIds = Array.from(new Set(input.items.map((item) => item.productId).filter((id): id is string => !!id)));
    const catalog = productIds.length ? await tx.select().from(products).where(and(inArray(products.id, productIds), eq(products.status, "active"))).for("update") : [];
    if (catalog.length !== productIds.length) throw new ApiError(400, "یک یا چند محصول سفارش فعال یا معتبر نیست.");
    const productById = new Map(catalog.map((product) => [product.id, product]));
    const netTotal = input.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice ?? (item.productId ? productById.get(item.productId)?.basePrice : 0) ?? 0) - Number(item.discountAmount ?? 0), 0);
    if (Number(input.invoiceDiscount ?? 0) > netTotal) throw new ApiError(400, "تخفیف کل از مبلغ سفارش بیشتر است.");
    const requested = new Map<string, number>();
    for (const item of input.items) if (item.productId) requested.set(item.productId, (requested.get(item.productId) || 0) + Number(item.quantity));
    const ready = [...requested].every(([id, quantity]) => Number(productById.get(id)!.stockQuantity) >= quantity);
    const [order] = await tx.insert(orders).values({
      requestKey: input.requestKey,
      requestHash: input.requestHash,
      orderNumber: `ORD-${crypto.randomUUID()}`,
      customerId: input.customerId,
      projectId: input.projectId || null,
      employeeId: input.employeeId || null,
      status: ready ? "ready" : "open",
      deliveryDate: input.deliveryDate || null,
      validUntil: input.validUntil || null,
      deliveryAddress: input.deliveryAddress?.trim() || null,
      paymentTerms: input.paymentTerms?.trim() || null,
      invoiceDiscount: String(input.invoiceDiscount ?? 0),
      notes: input.notes?.trim() || null,
      createdById: input.createdById || "system_user",
    }).returning();
    await tx.insert(orderItems).values(input.items.map((item) => {
      const product = item.productId ? productById.get(item.productId) : null;
      const price = Number(item.unitPrice ?? product?.basePrice ?? 0);
      if (Number(item.discountAmount ?? 0) > Number(item.quantity) * price) throw new ApiError(400, "تخفیف ردیف از مبلغ آن بیشتر است.");
      return {
        orderId: order.id,
        productId: product?.id || null,
        productNameSnapshot: product?.name || item.productName!.trim(),
        quantity: Number(item.quantity).toString(),
        unitPriceSnapshot: price.toString(),
        discountAmount: String(item.discountAmount ?? 0),
        notes: item.notes?.trim() || null,
      };
    }));
    await logAuditEvent("ORDER_CREATE", "order", order.id, { orderNumber: order.orderNumber, customerId: order.customerId, itemCount: input.items.length }, undefined, tx);
    return order;
  });
}

export async function updateOrder(orderId: string, input: OrderInput) {
  assertUuid(orderId); validateInput(input);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!existing) throw new ApiError(404, "سفارش یافت نشد.");
    if (existing.status === "converted" || existing.status === "cancelled") throw new ApiError(409, "سفارش قطعی یا لغوشده قابل ویرایش نیست.");
    const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) throw new ApiError(404, "مشتری یافت نشد.");
    const ids = [...new Set(input.items.map((item) => item.productId).filter((id): id is string => !!id))];
    const catalog = ids.length ? await tx.select().from(products).where(and(inArray(products.id, ids), eq(products.status, "active"))).for("update") : [];
    if (catalog.length !== ids.length) throw new ApiError(400, "یک یا چند محصول معتبر نیست.");
    const byId = new Map(catalog.map((item) => [item.id, item]));
    const netTotal = input.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice ?? (item.productId ? byId.get(item.productId)?.basePrice : 0) ?? 0) - Number(item.discountAmount ?? 0), 0);
    if (Number(input.invoiceDiscount ?? 0) > netTotal) throw new ApiError(400, "تخفیف کل از مبلغ سفارش بیشتر است.");
    const quantities = new Map<string, number>();
    for (const item of input.items) if (item.productId) quantities.set(item.productId, (quantities.get(item.productId) || 0) + Number(item.quantity));
    const ready = [...quantities].every(([id, count]) => Number(byId.get(id)!.stockQuantity) >= count);
    const [updated] = await tx.update(orders).set({
      customerId: input.customerId, status: ready ? "ready" : "open", deliveryDate: input.deliveryDate || null,
      validUntil: input.validUntil || null, deliveryAddress: input.deliveryAddress?.trim() || null,
      paymentTerms: input.paymentTerms?.trim() || null, invoiceDiscount: String(input.invoiceDiscount ?? 0),
      notes: input.notes?.trim() || null, updatedAt: new Date(),
    }).where(eq(orders.id, orderId)).returning();
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await tx.insert(orderItems).values(input.items.map((item) => {
      const product = item.productId ? byId.get(item.productId) : null;
      const price = Number(item.unitPrice ?? product?.basePrice ?? 0);
      if (Number(item.discountAmount ?? 0) > Number(item.quantity) * price) throw new ApiError(400, "تخفیف ردیف از مبلغ آن بیشتر است.");
      return { orderId, productId: product?.id || null, productNameSnapshot: product?.name || item.productName!.trim(),
        quantity: String(item.quantity), unitPriceSnapshot: String(price), discountAmount: String(item.discountAmount ?? 0), notes: item.notes?.trim() || null };
    }));
    await logAuditEvent("ORDER_UPDATE", "order", orderId, { orderNumber: existing.orderNumber, before: { status: existing.status }, after: { status: updated.status } }, undefined, tx);
    return updated;
  });
}

export async function cancelOrder(orderId: string, reason?: string, auditContext?: AuditContext) {
  assertUuid(orderId);
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    if (order.status === "converted") throw new ApiError(409, "سفارش تبدیل‌شده قابل لغو نیست.");
    if (order.status === "cancelled") {
      if (auditContext?.parentLogId) throw new ApiError(409, "این سفارش قبلاً لغو شده است.");
      return order;
    }
    const [updated] = await tx.update(orders).set({ status: "cancelled", notes: reason?.trim() || order.notes, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    await logAuditEvent("ORDER_CANCEL", "order", order.id, { orderNumber: order.orderNumber, projectId: order.projectId, reason: reason || null, before: { status: order.status }, after: { status: "cancelled" } }, auditContext, tx);
    return updated;
  });
}

export type OrderConversionInput = Pick<CreateInvoiceInput, "invoiceDate" | "dueDate" | "invoiceDiscount" | "items" | "initialPayment" | "notes">;

export async function convertOrderToInvoice(orderId: string, actorId: string, draft?: OrderConversionInput) {
  assertUuid(orderId);
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    if (order.status === "converted") throw new ApiError(409, "این سفارش قبلاً به فاکتور تبدیل شده است.");
    if (order.status === "cancelled") throw new ApiError(409, "سفارش لغوشده قابل تبدیل نیست.");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    if (!items.length) throw new ApiError(409, "سفارش بدون قلم قابل تبدیل نیست.");
    const invoiceInput: CreateInvoiceInput = {
      requestKey: `order-convert:${order.id}`,
      requestHash: crypto.createHash("sha256").update(JSON.stringify(draft || { updatedAt: order.updatedAt.toISOString() })).digest("hex"),
      customerId: order.customerId,
      projectId: order.projectId,
      employeeId: order.employeeId,
      salesMode: order.employeeId ? "visitor" : "direct",
      invoiceDate: draft?.invoiceDate || new Date(),
      dueDate: draft?.dueDate,
      invoiceDiscount: draft?.invoiceDiscount ?? Number(order.invoiceDiscount),
      items: draft?.items?.length ? draft.items : items.map((item) => ({ productId: item.productId, productName: item.productNameSnapshot, isCustom: !item.productId, quantity: Number(item.quantity), unitPrice: Number(item.unitPriceSnapshot), discountAmount: Number(item.discountAmount), customNotes: item.notes || undefined })),
      initialPayment: draft?.initialPayment,
      notes: draft?.notes || [order.notes, `تبدیل‌شده از سفارش ${order.orderNumber}`].filter(Boolean).join(" - "),
    };
    const invoice = await createInvoice(invoiceInput, tx);
    await tx.update(orders).set({ status: "converted", convertedInvoiceId: invoice.id, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await logAuditEvent("ORDER_CONVERT", "order", order.id, { orderNumber: order.orderNumber, invoiceId: invoice.id, actorId, before: { status: order.status }, after: { status: "converted" } }, undefined, tx);
    return invoice;
  });
}
