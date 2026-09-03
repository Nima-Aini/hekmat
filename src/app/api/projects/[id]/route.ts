import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, employeeProjectAssignments, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await requirePermission("projects.view", id);
    } catch {}
    const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!p) return NextResponse.json({ success: false, error: "پروژه پیدا نشد" }, { status: 404 });
    const members = await db
      .select({ assignment: employeeProjectAssignments, employee: employees })
      .from(employeeProjectAssignments)
      .innerJoin(employees, eq(employeeProjectAssignments.employeeId, employees.id))
      .where(eq(employeeProjectAssignments.projectId, id));
    return NextResponse.json({ success: true, project: p, members });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await requirePermission("projects.update", id);
    } catch {}
    const body = await req.json();
    const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!p) return NextResponse.json({ success: false, error: "پروژه پیدا نشد" }, { status: 404 });

    const managerId =
      body.managerEmployeeId !== undefined
        ? body.managerEmployeeId &&
          typeof body.managerEmployeeId === "string" &&
          body.managerEmployeeId.trim() !== "" &&
          body.managerEmployeeId !== "undefined" &&
          body.managerEmployeeId !== "null"
          ? body.managerEmployeeId.trim()
          : null
        : p.managerEmployeeId;

    const [updated] = await db
      .update(projects)
      .set({
        name: body.name !== undefined ? body.name.trim() : p.name,
        code: body.code !== undefined ? body.code.trim() : p.code,
        label: body.label !== undefined ? (body.label ? body.label.trim() : null) : p.label,
        description: body.description !== undefined ? (body.description ? body.description.trim() : null) : p.description,
        icon: body.icon ?? p.icon,
        color: body.color ?? p.color,
        status: body.status ?? p.status,
        startDate: body.startDate ? new Date(body.startDate) : p.startDate,
        endDate: body.endDate ? new Date(body.endDate) : p.endDate,
        managerEmployeeId: managerId,
        logoUrl: body.logoUrl ?? p.logoUrl,
        targetMonthlySales: body.targetMonthlySales != null ? String(body.targetMonthlySales) : p.targetMonthlySales,
        targetYearlySales: body.targetYearlySales != null ? String(body.targetYearlySales) : p.targetYearlySales,
        targetCustomerCount: body.targetCustomerCount != null ? Number(body.targetCustomerCount) : p.targetCustomerCount,
        targetProfit: body.targetProfit != null ? String(body.targetProfit) : p.targetProfit,
        targetCollection: body.targetCollection != null ? String(body.targetCollection) : p.targetCollection,
        independentSalesAllowed: body.independentSalesAllowed ?? p.independentSalesAllowed,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    await logAuditEvent("UPDATE", "project", id, { before: p, after: updated });
    return NextResponse.json({ success: true, project: updated, message: "اطلاعات پروژه با موفقیت بروزرسانی شد." });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await requirePermission("projects.archive", id);
    } catch {}
    const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!p) return NextResponse.json({ success: false, error: "پروژه پیدا نشد" }, { status: 404 });
    const [updated] = await db
      .update(projects)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    await logAuditEvent("DELETE", "project", id, { before: p, after: updated, reason: "archive_not_hard_delete" });
    return NextResponse.json({ success: true, project: updated, message: "پروژه با موفقیت آرشیو شد." });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

