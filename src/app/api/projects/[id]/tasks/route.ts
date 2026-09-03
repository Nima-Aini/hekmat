import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await requirePermission("projects.view", id); const rows = await db.select().from(tasks).where(and(eq(tasks.entityType, "project"), eq(tasks.entityId, id))).orderBy(desc(tasks.createdAt)); return NextResponse.json({ success: true, tasks: rows }); }
  catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 403 }); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await requirePermission("projects.update", id); const b = await req.json(); if (!b.title) return NextResponse.json({ success: false, error: "عنوان Task الزامی است" }, { status: 400 }); const [row] = await db.insert(tasks).values({ title: b.title, description: b.description || null, assignedEmployeeId: b.assignedEmployeeId || null, entityType: "project", entityId: id, dueDate: b.dueDate ? new Date(b.dueDate) : null, priority: b.priority || "medium", status: b.status || "open" }).returning(); await logAuditEvent("CREATE", "task", row.id, { projectId: id }); return NextResponse.json({ success: true, task: row }); }
  catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 403 }); }
}
