import { NextResponse } from "next/server";
import { db } from "@/db";
import { employees, employeeAccounts, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
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
    return NextResponse.json({
      success: true,
      employee: row.employee,
      account: { username: row.account.username, lastLoginAt: row.account.lastLoginAt },
      role: { code: row.roleCode, name: row.roleName },
      permissions: permissions.map((p) => p.code),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "خطا در بررسی هویت" }, { status: 500 });
  }
}
