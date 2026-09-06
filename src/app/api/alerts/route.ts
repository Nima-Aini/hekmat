import { apiError, assertUuid, pageNumber } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, and, asc, count, desc, inArray, or, sql } from "drizzle-orm";
import { runAlertsEngineScan } from "@/services/alerts";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    await requirePermission("alerts.view", projectId);
    if (projectId) assertUuid(projectId);

    await runAlertsEngineScan();
    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 20, 100);
    const status = searchParams.get("status") || "unresolved";
    const conditions = [];
    if (projectId) conditions.push(or(sql`${alerts.projectId} IS NULL`, eq(alerts.projectId, projectId))!);
    if (status === "unresolved") conditions.push(inArray(alerts.status, ["new", "active", "in_review"]));
    else if (status === "resolved") conditions.push(inArray(alerts.status, ["resolved", "auto_closed"]));
    if (searchParams.get("type")) conditions.push(eq(alerts.type, searchParams.get("type")!));
    if (searchParams.get("severity")) conditions.push(eq(alerts.severity, searchParams.get("severity")!));
    const where = and(...conditions);
    const sortBy = searchParams.get("sortBy") || "newest";
    const order = sortBy === "oldest" ? asc(alerts.createdAt) : sortBy === "severity" ? asc(sql`CASE ${alerts.severity} WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END`) : desc(alerts.createdAt);
    const [list, [totalRow]] = await Promise.all([
      db.select().from(alerts).where(where).orderBy(order, desc(alerts.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(alerts).where(where),
    ]);
    const total = Number(totalRow?.total || 0);
    return NextResponse.json({ success: true, alerts: list, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission("alerts.resolve");
    const body = await req.json();

    if (body.action === "resolve" && body.alertId) {
      assertUuid(body.alertId);
      const alert = await db.select().from(alerts).where(eq(alerts.id, body.alertId)).limit(1);
      if (alert.length === 0) {
        return NextResponse.json({ success: false, error: "هشدار یافت نشد" }, { status: 404 });
      }

      await db.transaction(async (tx) => {
        await tx.update(alerts).set({ status: "resolved", updatedAt: new Date() }).where(eq(alerts.id, body.alertId));
        await logAuditEvent("ALERT_RESOLVE", "alert", body.alertId, { type: alert[0].type, projectId: alert[0].projectId }, undefined, tx);
      });

      return NextResponse.json({ success: true, message: "هشدار برطرف گردید." });
    }

    return NextResponse.json({ success: false, error: "عملیات نامعتبر" }, { status: 400 });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}
