import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { runAlertsEngineScan, getActiveAlerts } from "@/services/alerts";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    await requirePermission("alerts.view", projectId);

    await runAlertsEngineScan();

    const activeList = await getActiveAlerts(projectId);
    return NextResponse.json({ success: true, alerts: activeList });
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
      const alert = await db.select().from(alerts).where(eq(alerts.id, body.alertId)).limit(1);
      if (alert.length === 0) {
        return NextResponse.json({ success: false, error: "هشدار یافت نشد" }, { status: 404 });
      }

      await db
        .update(alerts)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(eq(alerts.id, body.alertId));

      return NextResponse.json({ success: true, message: "هشدار برطرف گردید." });
    }

    return NextResponse.json({ success: false, error: "عملیات نامعتبر" }, { status: 400 });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}
