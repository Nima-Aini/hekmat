import { NextResponse } from "next/server";
import { reverseInvoice } from "@/services/invoice";
import { requirePermission } from "@/services/access";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await requirePermission("invoices.update");

    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "فاکتور مورد نظر یافت نشد" }, { status: 404 });
    }

    if (existing.status === "cancelled" || existing.status === "reversed") {
      return NextResponse.json({ success: false, error: "این فاکتور قبلاً ابطال شده است." }, { status: 400 });
    }

    const reversed = await reverseInvoice(id, body.reason || "ابطال فاکتور توسط کاربر");
    return NextResponse.json({ success: true, invoice: reversed, message: "فاکتور با موفقیت ابطال شد و موجودی انبار بازگردانی گردید." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "خطا در ابطال فاکتور" }, { status: 500 });
  }
}
