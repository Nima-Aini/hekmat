import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { db } from "@/db";
import { employees, employeeProjectAssignments, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";

const FORBIDDEN_ROLE_ESCALATION = ["admin"];

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    await requirePermission("employees.view");
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!employee) return NextResponse.json({ success: false, error: "همکار پیدا نشد" }, { status: 404 });
    const memberships = await db
      .select({ assignment: employeeProjectAssignments, project: projects })
      .from(employeeProjectAssignments)
      .leftJoin(projects, eq(employeeProjectAssignments.projectId, projects.id))
      .where(eq(employeeProjectAssignments.employeeId, id));
    return NextResponse.json({ success: true, employee, projects: memberships });
  } catch (e: any) {
    return apiError(e);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    await requirePermission("employees.manage");
    const body = await req.json();
    const [before] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!before) return NextResponse.json({ success: false, error: "همکار پیدا نشد" }, { status: 404 });

    const [updated] = await db
      .update(employees)
      .set({
        name: body.name ?? before.name,
        firstName: body.firstName ?? before.firstName,
        lastName: body.lastName ?? before.lastName,
        mobile: body.mobile ?? before.mobile,
        phone: body.phone ?? before.phone,
        nationalId: body.nationalId ?? before.nationalId,
        avatarUrl: body.avatarUrl ?? before.avatarUrl,
        address: body.address ?? before.address,
        description: body.description ?? before.description,
        cooperationType: body.cooperationType ?? before.cooperationType,
        role: body.role !== undefined && FORBIDDEN_ROLE_ESCALATION.includes(body.role) && before.role !== "admin"
          ? before.role
          : (body.role ?? before.role),
        status: body.status ?? before.status,
        activityScope: body.activityScope ?? before.activityScope,
        managerId: body.managerId ?? before.managerId,
        commissionRatePercent: body.commissionRatePercent != null ? String(body.commissionRatePercent) : before.commissionRatePercent,
        commissionBase: body.commissionBase ?? before.commissionBase,
        baseSalary: body.baseSalary != null ? String(body.baseSalary) : before.baseSalary,
        notes: body.notes ?? before.notes,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();

    await logAuditEvent("UPDATE", "employee", id, { before, after: updated });
    return NextResponse.json({ success: true, employee: updated });
  } catch (e: any) {
    return apiError(e);
  }
}
