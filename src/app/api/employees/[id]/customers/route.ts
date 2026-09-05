import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { db } from "@/db";
import { customers, customerAssignments, projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("customers.view");const rows=await db.select().from(customers).where(eq(customers.assignedEmployeeId,id)).orderBy(desc(customers.updatedAt));const history=await db.select({assignment:customerAssignments,project:projects}).from(customerAssignments).leftJoin(projects,eq(customerAssignments.projectId,projects.id)).where(eq(customerAssignments.employeeId,id)).orderBy(desc(customerAssignments.assignedAt));return NextResponse.json({success:true,customers:rows,history});}catch(e:any){return apiError(e);}}
