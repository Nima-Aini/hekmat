import { NextResponse } from "next/server";
import { db } from "@/db";
import { employeeAccounts, employees, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signSession, ensureDefaultAdminAccount } from "@/services/employeeAuth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password)
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
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

