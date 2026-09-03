import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, employeeProjectAssignments } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { getEmployeeContext, getScopedProjectIds, requirePermission } from "@/services/access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    try {
      await requirePermission("projects.view");
    } catch (e: any) {
      console.warn("requirePermission notice in GET /api/projects:", e?.message);
    }
    let list = await db.select().from(projects).orderBy(desc(projects.createdAt));
    const scope = await getScopedProjectIds();
    const context = await getEmployeeContext();
    if (scope && context && !context.permissions.has("*")) {
      list = list.filter((p) => scope.includes(p.id) || p.managerEmployeeId === context.employeeId);
    }
    return NextResponse.json({ success: true, projects: list });
  } catch (error: any) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ success: false, error: error?.message || "خطا در دریافت پروژه‌ها" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let context: any = null;
    try {
      context = await requirePermission("projects.create");
    } catch (e: any) {
      console.warn("requirePermission notice in POST /api/projects:", e?.message);
    }

    const body = await req.json();
    const name = body.name?.trim();
    let code = body.code?.trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "نام پروژه الزامی است." }, { status: 400 });
    }

    if (!code) {
      code = `PRJ-${Date.now().toString().slice(-5)}`;
    }

    // Check duplicate code
    const existing = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.code, code))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        success: false,
        error: `کد پروژه «${code}» قبلاً برای «${existing[0].name}» ثبت شده است. لطفاً کد یکتای دیگری وارد نمایید.`,
      }, { status: 400 });
    }

    // Sanitize managerEmployeeId
    const managerId =
      body.managerEmployeeId &&
      typeof body.managerEmployeeId === "string" &&
      body.managerEmployeeId.trim() !== "" &&
      body.managerEmployeeId !== "undefined" &&
      body.managerEmployeeId !== "null"
        ? body.managerEmployeeId.trim()
        : null;

    const [created] = await db
      .insert(projects)
      .values({
        code,
        name,
        label: body.label?.trim() || null,
        description: body.description?.trim() || null,
        color: body.color || "#3b82f6",
        icon: body.icon || "folder",
        status: body.status || "active",
        managerEmployeeId: managerId,
        logoUrl: body.logoUrl || null,
        targetMonthlySales: body.targetMonthlySales != null ? String(body.targetMonthlySales) : "0",
        targetYearlySales: body.targetYearlySales != null ? String(body.targetYearlySales) : "0",
        targetCustomerCount: body.targetCustomerCount != null ? Number(body.targetCustomerCount) : 0,
        targetProfit: body.targetProfit != null ? String(body.targetProfit) : "0",
        targetCollection: body.targetCollection != null ? String(body.targetCollection) : "0",
        independentSalesAllowed: body.independentSalesAllowed === true,
      })
      .returning();

    // If a manager or creator employee is set, auto-assign them to this project
    if (managerId) {
      try {
        await db
          .insert(employeeProjectAssignments)
          .values({
            employeeId: managerId,
            projectId: created.id,
            role: "manager",
            status: "active",
            permissionSet: { "*": true },
          })
          .onConflictDoNothing();
      } catch {}
    }
    if (context?.employeeId && context.employeeId !== managerId) {
      try {
        await db
          .insert(employeeProjectAssignments)
          .values({
            employeeId: context.employeeId,
            projectId: created.id,
            role: "member",
            status: "active",
            permissionSet: { "*": true },
          })
          .onConflictDoNothing();
      } catch {}
    }

    try {
      await logAuditEvent("CREATE", "project", created.id, {
        code: created.code,
        name: created.name,
      }, { userId: context?.employeeId || "system", userName: context?.roleCode || "کاربر سیستم" });
    } catch {}

    return NextResponse.json({
      success: true,
      project: created,
      message: `پروژه «${created.name}» با موفقیت ثبت و ایجاد گردید.`,
    });
  } catch (error: any) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ success: false, error: error?.message || "خطا در ثبت پروژه" }, { status: 500 });
  }
}

