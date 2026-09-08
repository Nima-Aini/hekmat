import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { convertOrderToInvoice } from "@/services/order";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new ApiError(404, "سفارش یافت نشد.");
    const context = await requirePermission("orders.convert", order.projectId);
    if (!context.permissions.has("*") && !context.permissions.has("orders.manage") && order.employeeId !== context.employeeId) throw new ApiError(403, "تبدیل این سفارش مجاز نیست.");
    const body = await req.json().catch(() => ({}));
    const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : undefined;
    const dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (invoiceDate && Number.isNaN(invoiceDate.getTime())) throw new ApiError(400, "تاریخ صدور فاکتور نامعتبر است.");
    if (dueDate && Number.isNaN(dueDate.getTime())) throw new ApiError(400, "تاریخ سررسید فاکتور نامعتبر است.");
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500) throw new ApiError(400, "اقلام فاکتور نامعتبر است.");
    for (const item of body.items) {
      if (item.productId) assertUuid(String(item.productId));
      if (!item.productId && !String(item.productName || "").trim()) throw new ApiError(400, "عنوان آیتم دستی الزامی است.");
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) throw new ApiError(400, "تعداد قلم نامعتبر است.");
      if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) throw new ApiError(400, "قیمت قلم نامعتبر است.");
    }
    if (body.initialPayment) {
      const amount = Number(body.initialPayment.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, "مبلغ پرداخت اولیه نامعتبر است.");
      if (amount > 0 && !body.initialPayment.accountId) throw new ApiError(400, "انتخاب حساب دریافت الزامی است.");
      if (body.initialPayment.accountId) assertUuid(String(body.initialPayment.accountId));
      if (!["cash", "pos", "card_transfer", "cheque", "bank_transfer"].includes(body.initialPayment.paymentMethod || "pos")) throw new ApiError(400, "روش پرداخت اولیه نامعتبر است.");
      if (body.initialPayment.paymentDate && Number.isNaN(new Date(body.initialPayment.paymentDate).getTime())) throw new ApiError(400, "تاریخ پرداخت اولیه نامعتبر است.");
    }
    const invoice = await convertOrderToInvoice(id, context.employeeId, {
      invoiceDate,
      dueDate,
      invoiceDiscount: Number(body.invoiceDiscount || 0),
      items: body.items,
      initialPayment: body.initialPayment ? { ...body.initialPayment, amount: Number(body.initialPayment.amount), paymentDate: body.initialPayment.paymentDate ? new Date(body.initialPayment.paymentDate) : undefined } : undefined,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, invoice, message: "سفارش به‌صورت اتمیک به فاکتور تبدیل شد." });
  } catch (error) { return apiError(error); }
}
