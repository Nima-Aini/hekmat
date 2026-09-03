import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, employeeProjectAssignments, projects } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";
import { getEmployeeDashboard } from "@/services/partner";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await requirePermission("employees.manage");
    const [projectsRows, activity, today, month, year] = await Promise.all([
      db.select({ assignment: employeeProjectAssignments, project: projects }).from(employeeProjectAssignments).leftJoin(projects,eq(employeeProjectAssignments.projectId,projects.id)).where(eq(employeeProjectAssignments.employeeId,id)),
      db.select().from(auditLogs).where(and(eq(auditLogs.entityType,"employee"),eq(auditLogs.entityId,id))).orderBy(desc(auditLogs.createdAt)).limit(100),
      getEmployeeDashboard(id,"today"), getEmployeeDashboard(id,"month"), getEmployeeDashboard(id,"year")
    ]);
    return NextResponse.json({success:true,projects:projectsRows,activity,reports:{today,month,year}});
  } catch(e){ return NextResponse.json({success:false,error:e instanceof Error?e.message:"خطا"},{status:403}); }
}
