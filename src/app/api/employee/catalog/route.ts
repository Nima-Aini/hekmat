import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, employeeProjectAssignments, products, projects } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";

export async function GET() {
  try {
    const context = await requirePermission("invoices.create");
    const productRows = await db
      .select({ id: products.id, code: products.code, name: products.name, unit: products.unit, basePrice: products.basePrice, status: products.status })
      .from(products)
      .where(eq(products.status, "active"))
      .orderBy(products.name);

    let projectRows = await db.select().from(projects).where(eq(projects.status, "active")).orderBy(desc(projects.createdAt));
    if (!context.permissions.has("*")) {
      const assignments = await db
        .select({ projectId: employeeProjectAssignments.projectId })
        .from(employeeProjectAssignments)
        .where(and(eq(employeeProjectAssignments.employeeId, context.employeeId), eq(employeeProjectAssignments.status, "active")));
      const ids = new Set(assignments.map((x) => x.projectId));
      projectRows = projectRows.filter((p) => ids.has(p.id) || p.managerEmployeeId === context.employeeId);
    }

    const accountRows = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type, isDefault: accounts.isDefault })
      .from(accounts)
      .orderBy(desc(accounts.isDefault), accounts.name);

    return NextResponse.json({
      success: true,
      products: productRows.map((p) => ({ ...p, basePrice: Number(p.basePrice) })),
      projects: projectRows,
      accounts: accountRows,
    });
  } catch (error: any) {
    return apiError(error);
  }
}
