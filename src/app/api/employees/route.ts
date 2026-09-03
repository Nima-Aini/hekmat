import { NextResponse } from "next/server";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { desc, eq, ilike, or } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    await requirePermission("employees.view");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    let list = await db.select().from(employees).orderBy(desc(employees.createdAt));
    if (q) list = list.filter((e: any) => [e.name, e.mobile, e.code, e.firstName || "", e.lastName || ""].some((v: string) => v.toLowerCase().includes(q.toLowerCase())));
    if (status) list = list.filter((e: any) => e.status === status);
    return NextResponse.json({ success: true, employees: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("employees.manage");
    const body = await req.json();
    if (!body.name || !body.mobile) {
      return NextResponse.json({ success: false, error: "نام و شماره موبایل کارمند الزامی است." }, { status: 400 });
    }

    const code = body.code || `EMP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [created] = await db
      .insert(employees)
      .values({
        code,
        name: body.name,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        mobile: body.mobile,
        phone: body.phone || null,
        nationalId: body.nationalId || null,
        avatarUrl: body.avatarUrl || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        address: body.address || null,
        description: body.description || null,
        cooperationType: body.cooperationType || body.role || "visitor",
        role: body.role || "visitor",
        commissionRatePercent: body.commissionRatePercent ? body.commissionRatePercent.toString() : "5.00",
        commissionBase: body.commissionBase || "sales_total",
        notes: body.notes || null,
        status: body.status || "active",
        offboardingStage: "active",
        startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
        activityScope: body.activityScope || null,
        managerId: body.managerId || null,
        baseSalary: body.baseSalary ? String(body.baseSalary) : "0",
      })
      .returning();

    await logAuditEvent("CREATE", "employee", created.id, { name: created.name, role: created.role });
    return NextResponse.json({ success: true, employee: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
