import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { apiError, assertUuid, pageNumber } from "@/lib/apiError";
import { parseReportDateParam } from "@/lib/dateUtils";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    await requirePermission("audit.view", projectId);
    if (projectId) assertUuid(projectId);
    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 20, 100);
    const conditions = [];
    if (projectId) conditions.push(eq(auditLogs.projectId, projectId));
    if (searchParams.get("action")) conditions.push(eq(auditLogs.action, searchParams.get("action")!));
    if (searchParams.get("entityType")) conditions.push(eq(auditLogs.entityType, searchParams.get("entityType")!));
    if (searchParams.get("userId")) conditions.push(eq(auditLogs.userId, searchParams.get("userId")!));
    const start = parseReportDateParam(searchParams.get("startDate"));
    const end = parseReportDateParam(searchParams.get("endDate"), true);
    if (start) conditions.push(gte(auditLogs.createdAt, start));
    if (end) conditions.push(lte(auditLogs.createdAt, end));
    const search = searchParams.get("search")?.trim();
    if (search) conditions.push(or(ilike(auditLogs.userName, `%${search}%`), ilike(auditLogs.action, `%${search}%`), ilike(auditLogs.entityType, `%${search}%`), sql`${auditLogs.details}::text ILIKE ${`%${search}%`}`)!);
    const where = and(...conditions);
    const [logs, [totalRow]] = await Promise.all([
      db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(auditLogs).where(where),
    ]);
    const total = Number(totalRow?.total || 0);
    return NextResponse.json({ success: true, logs, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) { return apiError(error); }
}
