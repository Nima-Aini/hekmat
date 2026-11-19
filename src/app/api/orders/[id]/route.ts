import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { cancelOrder, updateOrder } from "@/services/order";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; assertUuid(id);
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    const context = await requirePermission("orders.create", order.projectId);
    if (!context.permissions.has("*") && !context.permissions.has("orders.manage") && order.employeeId !== context.employeeId) throw new ApiError(403, "ویرایش این سفارش مجاز نیست.");
    const body = await req.json();
    const deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if ((deliveryDate && Number.isNaN(deliveryDate.getTime())) || (validUntil && Number.isNaN(validUntil.getTime()))) throw new ApiError(400, "تاریخ نامعتبر است.");
    const updated = await updateOrder(id, { customerId: body.customerId, items: body.items, deliveryDate, validUntil,
      invoiceDiscount: body.invoiceDiscount, deliveryAddress: body.deliveryAddress, paymentTerms: body.paymentTerms, notes: body.notes });
    return NextResponse.json({ success: true, order: updated });
  } catch (error) { return apiError(error); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    const context = await requirePermission("orders.cancel", order.projectId);
    if (!context.permissions.has("*") && !context.permissions.has("orders.manage") && order.employeeId !== context.employeeId) throw new ApiError(403, "لغو این سفارش مجاز نیست.");
    const body = await req.json().catch(() => ({}));
    const updated = await cancelOrder(id, body.reason);
    return NextResponse.json({ success: true, order: updated, message: "سفارش بدون اثر مالی لغو شد." });
  } catch (error) { return apiError(error); }
}
