import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, employees, customerProjectMemberships } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { recalculateCustomerHealth } from "@/services/customerHealth";
import { logAuditEvent } from "@/services/audit";
import { getEmployeeContext, requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    await requirePermission("customers.view");
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const offset = (page - 1) * pageSize;

    let list = await db
      .select({
        customer: customers,
        employeeName: employees.name,
      })
      .from(customers)
      .leftJoin(employees, eq(customers.assignedEmployeeId, employees.id))
      .orderBy(desc(customers.createdAt))
      .limit(pageSize)
      .offset(offset);

    const context = await getEmployeeContext();
    if (context && !context.permissions.has("*") && context.roleCode !== "admin" && context.roleCode !== "manager" && !context.permissions.has("customers.manage")) {
      list = list.filter((row) => row.customer.assignedEmployeeId === context.employeeId);
    }
    const projectId = searchParams.get("projectId");
    if (projectId) { const ids = await db.select({customerId: customerProjectMemberships.customerId}).from(customerProjectMemberships).where(eq(customerProjectMemberships.projectId, projectId)); const set = new Set(ids.map(x=>x.customerId)); list = list.filter(row=>set.has(row.customer.id)); }

    const formatted = list.map(({ customer, employeeName }) => ({
      ...customer,
      employeeName: employeeName || "بدون ویزیتور",
      assignedEmployeeName: employeeName || "بدون ویزیتور",
      latitude: customer.latitude ? Number(customer.latitude) : null,
      longitude: customer.longitude ? Number(customer.longitude) : null,
      creditLimit: Number(customer.creditLimit || 0),
      paymentTermsDays: Number(customer.paymentTermsDays || 30),
    }));

    return NextResponse.json({ success: true, customers: formatted, pagination: { page, pageSize } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
        assignedEmployeeId,
        notes: body.notes || null,
      })
      .returning();

    await recalculateCustomerHealth(created.id);
    if (assignedEmployeeId) {
      const projectId = body.projectId || null;
      const { assignCustomer } = await import("@/services/partner");
      await assignCustomer(created.id, assignedEmployeeId, projectId, "employee_created", context?.employeeId || assignedEmployeeId);
    }
    await logAuditEvent("CREATE", "customer", created.id, { name: created.name, mobile: created.mobile, employeeId: assignedEmployeeId, projectId: body.projectId || null });

    return NextResponse.json({ success: true, customer: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
