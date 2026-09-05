import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { reverseInvoice } from "@/services/invoice";
import { requirePermission } from "@/services/access";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const body = await req.json().catch(() => ({}));
    const context = await requirePermission("invoices.reverse");

    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "فاکتور مورد نظر یافت نشد" }, { status: 404 });
    }

    await requirePermission("invoices.reverse", existing.projectId);
    const manager = context.permissions.has("*") || ["admin", "manager"].includes(context.roleCode || "") || context.permissions.has("invoices.manage");
    if (!manager && existing.employeeId !== context.employeeId) return NextResponse.json({ success: false, error: "دسترسی به این فاکتور مجاز نیست." }, { status: 403 });
    if (existing.status === "cancelled" || existing.status === "reversed") {
      return NextResponse.json({ success: false, error: "این فاکتور قبلاً ابطال شده است." }, { status: 400 });
    }

    const reversed = await reverseInvoice(id, body.reason || "ابطال فاکتور توسط کاربر");
    return NextResponse.json({ success: true, invoice: reversed, message: "فاکتور با موفقیت ابطال شد و موجودی انبار بازگردانی گردید." });
  } catch (error: any) {
    return apiError(error);
  }
}
