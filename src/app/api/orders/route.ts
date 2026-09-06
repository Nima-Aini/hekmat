import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, employees, orderItems, orders, projects } from "@/db/schema";
import { ApiError, apiError, assertUuid, pageNumber } from "@/lib/apiError";
import { requestIdentity } from "@/lib/idempotency";
import { requirePermission } from "@/services/access";
import { createOrder } from "@/services/order";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const context = await requirePermission("orders.view", projectId);
    if (projectId) assertUuid(projectId);
    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 20, 100);
    const status = searchParams.get("status");
    const conditions = [];
    const id = searchParams.get("id");
    if (id) { assertUuid(id); conditions.push(eq(orders.id, id)); }
    const search = searchParams.get("search")?.trim();
    const manager = context.permissions.has("*") || context.permissions.has("orders.manage");
    if (!manager) conditions.push(eq(orders.employeeId, context.employeeId));
    if (projectId) conditions.push(eq(orders.projectId, projectId));
    if (status) conditions.push(eq(orders.status, status));
    if (search) conditions.push(or(ilike(orders.orderNumber, `%${search}%`), ilike(customers.name, `%${search}%`), ilike(customers.storeName, `%${search}%`))!);
    const where = and(...conditions);
    const sort = searchParams.get("sortOrder") === "asc" ? asc(orders.createdAt) : desc(orders.createdAt);
    const [rows, [totalRow]] = await Promise.all([
      db.select({ order: orders, customerName: customers.name, storeName: customers.storeName, projectName: projects.name, employeeName: employees.name })
        .from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).leftJoin(projects, eq(orders.projectId, projects.id)).leftJoin(employees, eq(orders.employeeId, employees.id))
        .where(where).orderBy(sort).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).where(where),
    ]);
    const ids = rows.map((row) => row.order.id);
    const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
    const total = Number(totalRow?.total || 0);
    return NextResponse.json({ success: true, orders: rows.map(({ order, ...rest }) => ({ ...order, ...rest, storeName: rest.storeName || rest.customerName, items: items.filter((item) => item.orderId === order.id) })), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("orders.create", body.projectId || null);
    if (!body.customerId) throw new ApiError(400, "انتخاب مشتری الزامی است.");
    const deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
    if (deliveryDate && Number.isNaN(deliveryDate.getTime())) throw new ApiError(400, "تاریخ تحویل نامعتبر است.");
    const manager = context.permissions.has("*") || context.permissions.has("orders.manage");
    let employeeId = manager ? (body.employeeId || null) : context.employeeId;
    if (!manager) {
      const [customer] = await db.select({ assignedEmployeeId: customers.assignedEmployeeId }).from(customers).where(eq(customers.id, body.customerId)).limit(1);
      if (!customer || (customer.assignedEmployeeId && customer.assignedEmployeeId !== context.employeeId)) throw new ApiError(403, "ثبت سفارش برای این مشتری مجاز نیست.");
      employeeId = context.employeeId;
    }
    const identity = requestIdentity(req, context.employeeId, body);
    const order = await createOrder({ ...identity, customerId: body.customerId, projectId: body.projectId || null, employeeId, deliveryDate, notes: body.notes, items: body.items, createdById: context.employeeId });
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) { return apiError(error); }
}
