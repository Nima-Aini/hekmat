import { pageNumber } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, employees, customerProjectMemberships } from "@/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { recalculateCustomerHealth } from "@/services/customerHealth";
import { logAuditEvent } from "@/services/audit";
import { getEmployeeContext, requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    await requirePermission("customers.view");
    const { searchParams } = new URL(req.url);
    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 20, 100);
    const offset = (page - 1) * pageSize;

    const context = await getEmployeeContext();
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search")?.trim();
    const conditions = [];
    if (context && !context.permissions.has("*") && context.roleCode !== "admin" && context.roleCode !== "manager" && !context.permissions.has("customers.manage")) {
      conditions.push(eq(customers.assignedEmployeeId, context.employeeId));
    }
    if (projectId) {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${customerProjectMemberships} cpm WHERE cpm.customer_id = ${customers.id} AND cpm.project_id = ${projectId})`);
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(ilike(customers.name, pattern), ilike(customers.storeName, pattern), ilike(customers.mobile, pattern), ilike(customers.code, pattern))!);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [countRow] = await db.select({ total: sql<number>`COUNT(*)` }).from(customers).where(where);
    const total = Number(countRow?.total || 0);
    const list = await db
      .select({
        customer: customers,
        employeeName: employees.name,
      })
      .from(customers)
      .leftJoin(employees, eq(customers.assignedEmployeeId, employees.id))
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(pageSize)
      .offset(offset);

    const formatted = list.map(({ customer, employeeName }) => ({
      ...customer,
      employeeName: employeeName || "بدون ویزیتور",
      assignedEmployeeName: employeeName || "بدون ویزیتور",
      latitude: customer.latitude ? Number(customer.latitude) : null,
      longitude: customer.longitude ? Number(customer.longitude) : null,
      creditLimit: Number(customer.creditLimit || 0),
      paymentTermsDays: Number(customer.paymentTermsDays || 30),
    }));

    return NextResponse.json({ success: true, customers: formatted, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("customers.create", body.projectId || null);
    if (!body.name || !body.mobile) {
      return NextResponse.json({ success: false, error: "نام مشتری و شماره موبایل الزامی است." }, { status: 400 });
    }

    const code = body.code || `CUST-${Date.now().toString().slice(-8)}`;

    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("customers.manage") || context.permissions.has("customers.transfer");
    const assignedEmployeeId = isManagerOrAdmin ? (body.assignedEmployeeId || null) : (context?.employeeId || null);

    const [created] = await db
      .insert(customers)
      .values({
        code,
        name: body.name,
        storeName: body.storeName || null,
        mobile: body.mobile,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        city: body.city || "تهران",
        latitude: body.latitude ? body.latitude.toString() : null,
        longitude: body.longitude ? body.longitude.toString() : null,
        creditLimit: body.creditLimit !== undefined ? Number(body.creditLimit).toString() : "0",
        paymentTermsDays: body.paymentTermsDays !== undefined ? Number(body.paymentTermsDays) : (body.settlementTermDays !== undefined ? Number(body.settlementTermDays) : 30),
        assignedEmployeeId: null,
        notes: body.notes || null,
      })
      .returning();

    await recalculateCustomerHealth(created.id);
    if (assignedEmployeeId || body.projectId) {
      const projectId = body.projectId || null;
      const { assignCustomer } = await import("@/services/partner");
      await assignCustomer(created.id, assignedEmployeeId, projectId, "employee_created", context?.employeeId || assignedEmployeeId);
    }
    await logAuditEvent("CREATE", "customer", created.id, { name: created.name, mobile: created.mobile, employeeId: assignedEmployeeId, projectId: body.projectId || null });

    return NextResponse.json({ success: true, customer: { ...created, assignedEmployeeId } });
  } catch (error: any) {
    return apiError(error);
  }
}
