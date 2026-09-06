import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { projectTargets } from "@/db/schema";
import { apiError, assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    await requirePermission("reports.view", id);
    const targets = await db.select().from(projectTargets)
      .where(eq(projectTargets.projectId, id)).orderBy(desc(projectTargets.periodStart));
    return NextResponse.json({ success: true, targets });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    await requirePermission("projects.update", id);
    const body = await req.json();
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
      return NextResponse.json({ success: false, error: "بازه هدف پروژه نامعتبر است." }, { status: 400 });
    }
    const values = ["salesTarget", "customerTarget", "profitTarget", "collectionTarget"].map((key) => Number(body[key] || 0));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ success: false, error: "مقادیر هدف پروژه باید عدد غیرمنفی باشند." }, { status: 400 });
    }
    const target = await db.transaction(async (tx) => {
      const [created] = await tx.insert(projectTargets).values({
        projectId: id,
        periodStart,
        periodEnd,
        salesTarget: String(values[0]),
        customerTarget: Math.floor(values[1]),
        profitTarget: String(values[2]),
        collectionTarget: String(values[3]),
      }).returning();
      await logAuditEvent("PROJECT_TARGET_CREATE", "project_target", created.id, { projectId: id, periodStart, periodEnd }, undefined, tx);
      return created;
    });
    return NextResponse.json({ success: true, target });
  } catch (error) {
    return apiError(error);
  }
}
