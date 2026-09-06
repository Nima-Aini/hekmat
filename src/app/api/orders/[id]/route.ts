import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { cancelOrder } from "@/services/order";

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
