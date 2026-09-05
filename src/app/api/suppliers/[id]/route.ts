import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("suppliers.update");
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();
    const [before] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!before) return NextResponse.json({ success: false, error: "تامین‌کننده پیدا نشد" }, { status: 404 });
    if (!body.name || !body.mobile) return NextResponse.json({ success: false, error: "نام و موبایل الزامی است." }, { status: 400 });
    const [updated] = await db.update(suppliers).set({
      code: body.code ?? before.code, name: body.name, contactPerson: body.contactPerson ?? null, mobile: body.mobile,
      phone: body.phone ?? null, email: body.email ?? null, address: body.address ?? null, city: body.city ?? null, notes: body.notes ?? null, updatedAt: new Date(),
    }).where(eq(suppliers.id, id)).returning();
    await logAuditEvent("UPDATE", "supplier", id, { before, after: updated });
    return NextResponse.json({ success: true, supplier: updated });
  } catch (e: any) { return apiError(e); }
}
