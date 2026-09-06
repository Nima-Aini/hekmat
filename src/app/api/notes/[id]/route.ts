import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; assertUuid(id);
    const body = await req.json();
    const [current] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!current || current.entityType !== "note") throw new ApiError(404, "یادداشت یافت نشد.");
    const permission = body.status === "completed" ? "notes.complete" : "notes.update";
    await requirePermission(permission, current.projectId);
    const nextStatus = body.status === undefined ? current.status : String(body.status);
    if (!["pending", "completed", "cancelled"].includes(nextStatus)) throw new ApiError(400, "وضعیت یادداشت نامعتبر است.");
    const dueDate = body.dueDate === undefined ? current.dueDate : body.dueDate ? new Date(body.dueDate) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) throw new ApiError(400, "تاریخ یادآوری نامعتبر است.");
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(tasks).set({ title: body.title === undefined ? current.title : String(body.title).trim(), description: body.description === undefined ? current.description : String(body.description).trim(), dueDate, status: nextStatus, completedAt: nextStatus === "completed" ? new Date() : null, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
      await logAuditEvent(nextStatus === "completed" ? "NOTE_COMPLETE" : "NOTE_UPDATE", "note", id, { before: { status: current.status, dueDate: current.dueDate }, after: { status: row.status, dueDate: row.dueDate } }, undefined, tx);
      return row;
    });
    return NextResponse.json({ success: true, note: updated });
  } catch (error) { return apiError(error); }
}
