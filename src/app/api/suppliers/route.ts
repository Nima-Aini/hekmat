import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { desc } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET() {
  try {
    await requirePermission("suppliers.view");
    const list = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
    return NextResponse.json({ success: true, suppliers: list });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("suppliers.create");
    const body = await req.json();
    if (!body.name || !body.mobile) {
      return NextResponse.json({ success: false, error: "نام تامین کننده و شماره موبایل الزامی است." }, { status: 400 });
    }

    const code = body.code || `SUP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [created] = await db
      .insert(suppliers)
      .values({
        code,
        name: body.name,
        contactPerson: body.contactPerson || null,
        mobile: body.mobile,
        phone: body.phone || null,
        address: body.address || null,
        city: body.city || "تهران",
        notes: body.notes || null,
      })
      .returning();

    await logAuditEvent("CREATE", "supplier", created.id, { name: created.name });
    return NextResponse.json({ success: true, supplier: created });
  } catch (error: any) {
    return apiError(error);
  }
}
