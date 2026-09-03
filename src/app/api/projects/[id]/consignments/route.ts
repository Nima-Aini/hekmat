import { NextResponse } from "next/server";
import { db } from "@/db";
import { consignments, customers, employees } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await requirePermission("projects.view", id); const rows = await db.select({ consignment: consignments, customerName: customers.name, employeeName: employees.name }).from(consignments).innerJoin(customers, eq(consignments.customerId, customers.id)).leftJoin(employees, eq(consignments.employeeId, employees.id)).where(eq(consignments.projectId, id)).orderBy(desc(consignments.issueDate)); return NextResponse.json({ success: true, consignments: rows }); }
  catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 403 }); }
}
