import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, invoices, payments, customerHealthLogs, employees } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { recalculateCustomerHealth } from "@/services/customerHealth";
import { logAuditEvent } from "@/services/audit";
import { getEmployeeContext, requirePermission } from "@/services/access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePermission("customers.view");
    const { id } = await params;

    const [customer] = await db
      .select({
        customer: customers,
        employeeName: employees.name,
      })
      .from(customers)
      .leftJoin(employees, eq(customers.assignedEmployeeId, employees.id))
      .where(eq(customers.id, id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ success: false, error: "مشتری یافت نشد" }, { status: 404 });
    }
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("customers.manage");
    if (!isManagerOrAdmin && customer.customer.assignedEmployeeId !== context?.employeeId) {
      return NextResponse.json({ success: false, error: "این مشتری متعلق به شما نیست" }, { status: 403 });
    }

    const customerInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, id))
      .orderBy(desc(invoices.invoiceDate));

    const customerPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.customerId, id))
      .orderBy(desc(payments.paymentDate));

    const healthLogs = await db
      .select()
      .from(customerHealthLogs)
      .where(eq(customerHealthLogs.customerId, id))
      .orderBy(desc(customerHealthLogs.createdAt));

    return NextResponse.json({
      success: true,
      customer: {
        ...customer.customer,
        employeeName: customer.employeeName || "بدون ویزیتور",
        assignedEmployeeName: customer.employeeName || "بدون ویزیتور",
        latitude: Number(customer.customer.latitude),
        longitude: Number(customer.customer.longitude),
        creditLimit: Number(customer.customer.creditLimit || 0),
        paymentTermsDays: Number(customer.customer.paymentTermsDays || 30),
      },
      invoices: customerInvoices,
      payments: customerPayments,
      healthLogs,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePermission("customers.update");
    const { id } = await params;
    const body = await req.json();
    const [owned] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!owned) return NextResponse.json({ success: false, error: "مشتری یافت نشد" }, { status: 404 });
    
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("customers.manage") || context.permissions.has("customers.transfer");
    if (!isManagerOrAdmin && owned.assignedEmployeeId !== context?.employeeId) {
      return NextResponse.json({ success: false, error: "دسترسی به ویرایش این مشتری را ندارید" }, { status: 403 });
    }
    
    const canTransfer = isManagerOrAdmin || (context && context.permissions.has("customers.transfer"));
    const nextAssignedEmployeeId = canTransfer 
      ? (body.assignedEmployeeId !== undefined ? (body.assignedEmployeeId || null) : owned.assignedEmployeeId) 
      : owned.assignedEmployeeId;

    const [updated] = await db
      .update(customers)
      .set({
        name: body.name !== undefined ? body.name : owned.name,
        storeName: body.storeName !== undefined ? body.storeName : owned.storeName,
        mobile: body.mobile !== undefined ? body.mobile : owned.mobile,
        phone: body.phone !== undefined ? body.phone : owned.phone,
        email: body.email !== undefined ? body.email : owned.email,
        address: body.address !== undefined ? body.address : owned.address,
        city: body.city !== undefined ? body.city : owned.city,
        latitude: body.latitude !== undefined ? body.latitude.toString() : owned.latitude,
        longitude: body.longitude !== undefined ? body.longitude.toString() : owned.longitude,
        creditLimit: body.creditLimit !== undefined ? Number(body.creditLimit).toString() : (body.credit_limit !== undefined ? Number(body.credit_limit).toString() : owned.creditLimit),
        paymentTermsDays: body.paymentTermsDays !== undefined ? Number(body.paymentTermsDays) : (body.settlementTermDays !== undefined ? Number(body.settlementTermDays) : owned.paymentTermsDays),
        assignedEmployeeId: nextAssignedEmployeeId,
        notes: body.notes !== undefined ? body.notes : owned.notes,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();

    if (nextAssignedEmployeeId && nextAssignedEmployeeId !== owned.assignedEmployeeId) {
      const { assignCustomer } = await import("@/services/partner");
      await assignCustomer(id, nextAssignedEmployeeId, null, "manager_reassigned", context?.employeeId || nextAssignedEmployeeId);
    }

    await recalculateCustomerHealth(id);
    await logAuditEvent("UPDATE", "customer", id, { name: updated.name, creditLimit: updated.creditLimit, assignedEmployeeId: nextAssignedEmployeeId });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
