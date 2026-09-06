import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { employees, employeeAccounts, employeeProjectAssignments, roles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifySession } from "@/services/employeeAuth";
import { employeePermissionSet } from "@/services/partner";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie")?.match(/(?:^|;\s*)employee_session=([^;]+)/)?.[1];
    const id = cookie ? verifySession(cookie) : null;
    if (!id) return NextResponse.json({ success: false }, { status: 401 });
    const [row] = await db
      .select({ employee: employees, account: employeeAccounts, roleCode: roles.code, roleName: roles.name })
      .from(employees)
      .innerJoin(employeeAccounts, eq(employeeAccounts.employeeId, employees.id))
      .leftJoin(roles, eq(employeeAccounts.roleId, roles.id))
      .where(eq(employees.id, id))
      .limit(1);
    if (!row || row.employee.status !== "active" || row.account.status !== "active") return NextResponse.json({ success: false }, { status: 401 });
    const permissions = await employeePermissionSet(id);
    const projectAssignments = await db.select({ permissionSet: employeeProjectAssignments.permissionSet }).from(employeeProjectAssignments)
      .where(and(eq(employeeProjectAssignments.employeeId, id), eq(employeeProjectAssignments.status, "active")));
    const navigationPermissions = new Set(permissions.map((permission) => permission.code));
    for (const assignment of projectAssignments) {
      for (const [code, enabled] of Object.entries((assignment.permissionSet || {}) as Record<string, unknown>)) if (enabled === true) navigationPermissions.add(code);
    }
    return NextResponse.json({
      success: true,
      employee: row.employee,
      account: { username: row.account.username, lastLoginAt: row.account.lastLoginAt },
      role: { code: row.roleCode, name: row.roleName },
      permissions: permissions.map((p) => p.code),
      navigationPermissions: Array.from(navigationPermissions),
    });
  } catch (error: any) {
    return apiError(error);
  }
}
