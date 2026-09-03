import { cookies } from "next/headers";
import { db } from "@/db";
import { employeeAccounts, employees, employeeProjectAssignments, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/services/employeeAuth";
import { employeePermissionSet } from "@/services/partner";

export type EmployeeContext = { employeeId: string; permissions: Set<string>; roleCode?: string };

export async function getEmployeeContext(): Promise<EmployeeContext | null> {
  try {
    const jar = await cookies();
    const raw = jar.get("employee_session")?.value;
    if (!raw) return null;
    const employeeId = verifySession(raw);
    if (!employeeId) return null;
    const [row] = await db
      .select({
        accountStatus: employeeAccounts.status,
        roleId: employeeAccounts.roleId,
        employeeStatus: employees.status,
        offboardingStage: employees.offboardingStage,
      })
      .from(employeeAccounts)
      .innerJoin(employees, eq(employeeAccounts.employeeId, employees.id))
      .where(eq(employeeAccounts.employeeId, employeeId))
      .limit(1);
    if (!row || row.accountStatus !== "active" || row.employeeStatus !== "active" || (row.offboardingStage && row.offboardingStage !== "active")) {
      return null;
    }
    const role = row.roleId
      ? (await db.select({ code: roles.code }).from(roles).where(eq(roles.id, row.roleId)).limit(1))[0]
      : null;
    const permissions = new Set((await employeePermissionSet(employeeId)).map((p) => p.code));
    return { employeeId, permissions, roleCode: role?.code };
  } catch (err) {
    console.error("getEmployeeContext error:", err);
    return null;
  }
}

export async function getScopedProjectIds() {
  const context = await getEmployeeContext();
  if (!context) return null;
  if (context.permissions.has("*")) return null;
  const rows = await db.select({ projectId: employeeProjectAssignments.projectId }).from(employeeProjectAssignments).where(eq(employeeProjectAssignments.employeeId, context.employeeId));
  return rows.map((r) => r.projectId);
}

export async function requirePermission(permission: string, projectId?: string | null) {
  const context = await getEmployeeContext();
  if (!context) {
    throw new Error("دسترسی غیرمجاز: لطفاً ابتدا وارد حساب کاربری خود شوید.");
  }
  if (context.permissions.has("*")) {
    return context;
  }
  if (context.permissions.has(permission)) {
    if (!projectId) return context;
    const rows = await db.select().from(employeeProjectAssignments).where(eq(employeeProjectAssignments.employeeId, context.employeeId));
    const matched = rows.find((a) => a.projectId === projectId && a.status === "active");
    if (!matched) throw new Error("دسترسی شما به این پروژه مجاز نیست.");
    const scoped = (matched.permissionSet || {}) as Record<string, unknown>;
    if (scoped[permission] === false) throw new Error("دسترسی شما به این عملیات در این پروژه محدود شده است.");
    return context;
  }
  if (projectId) {
    const rows = await db.select().from(employeeProjectAssignments).where(eq(employeeProjectAssignments.employeeId, context.employeeId));
    const matched = rows.find((a) => a.projectId === projectId && a.status === "active");
    if (!matched) throw new Error("دسترسی شما به این پروژه مجاز نیست.");
    const scoped = (matched.permissionSet || {}) as Record<string, unknown>;
    if (scoped[permission] === true) return context;
    if (scoped[permission] === false) throw new Error("دسترسی شما به این عملیات در این پروژه محدود شده است.");
  }
  throw new Error(`دسترسی موردنیاز برای این عملیات وجود ندارد: ${permission}`);
}
