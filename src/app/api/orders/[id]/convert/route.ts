import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { convertOrderToInvoice } from "@/services/order";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    const context = await requirePermission("orders.convert", order.projectId);
    if (!context.permissions.has("*") && !context.permissions.has("orders.manage") && order.employeeId !== context.employeeId) throw new ApiError(403, "تبدیل این سفارش مجاز نیست.");
    const invoice = await convertOrderToInvoice(id, context.employeeId);
    return NextResponse.json({ success: true, invoice, message: "سفارش به‌صورت اتمیک به فاکتور تبدیل شد." });
  } catch (error) { return apiError(error); }
}
