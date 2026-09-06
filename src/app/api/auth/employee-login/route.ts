import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { employeeAccounts, employees, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signSession } from "@/services/employeeAuth";
import { logAuditEvent } from "@/services/audit";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (typeof username !== "string" || typeof password !== "string" || !username || !password || username.length > 200 || password.length > 1024)
      return NextResponse.json({ success: false, error: "نام کاربری و رمز عبور الزامی است." }, { status: 400 });

    const [row] = await db
      .select({
        account: employeeAccounts,
        employee: employees,
        roleCode: roles.code,
        roleName: roles.name,
      })
      .from(employeeAccounts)
      .innerJoin(employees, eq(employeeAccounts.employeeId, employees.id))
      .leftJoin(roles, eq(employeeAccounts.roleId, roles.id))
      .where(eq(employeeAccounts.username, username))
      .limit(1);

    if (
      !row ||
      row.account.status !== "active" ||
      row.employee.status !== "active" ||
      !verifyPassword(password, row.account.passwordHash)
    ) {
      return NextResponse.json({ success: false, error: "نام کاربری یا رمز عبور نادرست است." }, { status: 401 });
    }

    await db
      .update(employeeAccounts)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(employeeAccounts.id, row.account.id));
    await logAuditEvent("LOGIN", "employee_account", row.account.id, { employeeId: row.employee.id, roleCode: row.roleCode }, { userId: row.employee.id, userName: row.employee.name });

    const response = NextResponse.json({
      success: true,
      employee: row.employee,
      role: { code: row.roleCode || row.employee.role || "visitor", name: row.roleName || "همکار" },
    });

    response.cookies.set("employee_session", signSession(row.employee.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SECURE_COOKIES !== "false" && process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return response;
  } catch (e: any) {
    return apiError(e);
  }
}
