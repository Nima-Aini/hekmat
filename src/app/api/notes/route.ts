import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { ApiError, apiError, assertUuid, pageNumber } from "@/lib/apiError";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    await requirePermission("notes.view", projectId);
    if (projectId) assertUuid(projectId);
    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 20, 100);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const conditions = [eq(tasks.entityType, "note")];
    if (projectId) conditions.push(eq(tasks.projectId, projectId));
    if (status) conditions.push(eq(tasks.status, status));
    if (search) conditions.push(or(ilike(tasks.title, `%${search}%`), ilike(tasks.description, `%${search}%`))!);
    const where = and(...conditions);
    const order = searchParams.get("sortOrder") === "asc" ? asc(tasks.createdAt) : desc(tasks.createdAt);
    const [rows, [totalRow]] = await Promise.all([
      db.select().from(tasks).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(tasks).where(where),
    ]);
    const total = Number(totalRow?.total || 0);
    return NextResponse.json({ success: true, notes: rows, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("notes.create", body.projectId || null);
    const description = String(body.description || "").trim();
    if (!description) throw new ApiError(400, "متن یادداشت الزامی است.");
    if (description.length > 5000) throw new ApiError(400, "متن یادداشت بیش از حد طولانی است.");
    if (body.projectId) assertUuid(body.projectId);
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) throw new ApiError(400, "تاریخ یادآوری نامعتبر است.");
    const [note] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(tasks).values({ title: String(body.title || description.slice(0, 80)).trim(), description, projectId: body.projectId || null, assignedEmployeeId: body.assignedEmployeeId || context.employeeId, createdById: context.employeeId, entityType: "note", dueDate, priority: body.priority || "medium", status: "pending" }).returning();
      await logAuditEvent("NOTE_CREATE", "note", created.id, { title: created.title, dueDate, projectId: created.projectId }, undefined, tx);
      return [created];
    });
    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error) { return apiError(error); }
}
