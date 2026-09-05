import { apiError, assertUuid } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, customerProjectMemberships, employees } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission } from "@/services/access";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    await requirePermission("customers.view", id);
    const rows = await db.select({ customer: customers, employeeName: employees.name })
      .from(customerProjectMemberships)
      .innerJoin(customers, eq(customerProjectMemberships.customerId, customers.id))
      .leftJoin(employees, eq(customers.assignedEmployeeId, employees.id))
      .where(eq(customerProjectMemberships.projectId, id))
      .orderBy(desc(customerProjectMemberships.assignedAt));
    return NextResponse.json({ success: true, customers: rows.map(({customer, employeeName}) => ({...customer, employeeName: employeeName || "-", latitude: Number(customer.latitude), longitude: Number(customer.longitude)})) });
  } catch (e) {
    return apiError(e);
  }
}
