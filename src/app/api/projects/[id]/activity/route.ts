import { apiError, assertUuid } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params;
    assertUuid(id); await requirePermission("reports.view", id); const rows = await db.select().from(auditLogs).where(eq(auditLogs.entityType, "project")).orderBy(desc(auditLogs.createdAt)).limit(100); return NextResponse.json({success:true, activity: rows.filter(r => r.entityId === id)}); }
  catch(e){ return apiError(e); }
}
