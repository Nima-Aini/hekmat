import { NextResponse } from "next/server";
import { db } from "@/db";
import { employeeProjectAssignments, employees, permissions, roles, rolePermissions, projects, employeeAccounts } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePermission("employees.manage");
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!employee) return NextResponse.json({ success: false, error: "همکار پیدا نشد" }, { status: 404 });
    const [account] = await db.select({ status: employeeAccounts.status, username: employeeAccounts.username, lastLoginAt: employeeAccounts.lastLoginAt }).from(employeeAccounts).where(eq(employeeAccounts.employeeId, id)).limit(1);
    const rows = await db.select({ assignment: employeeProjectAssignments, project: projects }).from(employeeProjectAssignments).leftJoin(projects, eq(employeeProjectAssignments.projectId, projects.id)).where(eq(employeeProjectAssignments.employeeId, id));
    const allPermissions = await db.select().from(permissions).orderBy(asc(permissions.code));
    const allRoles = await db.select().from(roles).orderBy(asc(roles.code));
    return NextResponse.json({ success: true, employee, account: account || null, projects: rows, permissions: allPermissions, roles: allRoles });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 403 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePermission("employees.manage");
    const body = await req.json();
    if (!body.projectId) return NextResponse.json({ success: false, error: "پروژه الزامی است" }, { status: 400 });
    const set = body.permissionSet && typeof body.permissionSet === "object" ? body.permissionSet : {};
    const [before] = await db.select().from(employeeProjectAssignments).where(eq(employeeProjectAssignments.employeeId, id)).limit(1);
    const [row] = await db.insert(employeeProjectAssignments).values({ employeeId: id, projectId: body.projectId, role: body.role || "member", permissionSet: set, commissionRate: body.commissionRate != null ? String(body.commissionRate) : null, projectSalary: body.projectSalary != null ? String(body.projectSalary) : "0", status: body.status || "active" }).onConflictDoUpdate({ target: [employeeProjectAssignments.employeeId, employeeProjectAssignments.projectId], set: { role: body.role || "member", permissionSet: set, commissionRate: body.commissionRate != null ? String(body.commissionRate) : null, projectSalary: body.projectSalary != null ? String(body.projectSalary) : "0", status: body.status || "active" } }).returning();
    await logAuditEvent("PERMISSION_CHANGE", "employee", id, { projectId: body.projectId, before, after: row });
    return NextResponse.json({ success: true, assignment: row });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 403 });
  }
}
