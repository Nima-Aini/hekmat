import { ApiError, assertUuid, pageNumber } from "@/lib/apiError";
import { requestIdentity } from "@/lib/idempotency";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceItems, customers, projects, employees, payments, accounts } from "@/db/schema";
import { asc, count, desc, eq, and, ilike, or, sql } from "drizzle-orm";
import { createInvoice, reverseInvoice } from "@/services/invoice";
import { getEmployeeContext, requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    const context = await requirePermission("invoices.view", new URL(req.url).searchParams.get("projectId"));
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const customerId = searchParams.get("customerId");
    if (projectId) assertUuid(projectId);
    if (customerId) assertUuid(customerId);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const paymentStatus = searchParams.get("paymentStatus")?.trim();
    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 20, 100);
    const offset = (page - 1) * pageSize;
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const direction = sortOrder === "asc" ? asc : desc;
    const sortExpression = (() => {
      switch (sortBy) {
        case "invoiceDate": return direction(invoices.invoiceDate);
        case "grandTotal": return direction(invoices.grandTotal);
        case "balanceDue": return direction(invoices.balanceDue);
        case "employee": return direction(employees.name);
        case "store": return direction(sql`COALESCE(${customers.storeName}, ${customers.name})`);
        case "invoiceNumber": return direction(invoices.invoiceNumber);
        case "status": return direction(invoices.status);
        case "paymentStatus": return direction(invoices.paymentStatus);
        default: return direction(invoices.createdAt);
      }
    })();

    const manager = context.permissions.has("*") || ["admin", "manager"].includes(context.roleCode || "") || context.permissions.has("invoices.manage");
    const conditions = [];
    if (!manager) conditions.push(eq(invoices.employeeId, context.employeeId));
    if (projectId) conditions.push(eq(invoices.projectId, projectId));
    if (customerId) conditions.push(eq(invoices.customerId, customerId));
    if (status) conditions.push(eq(invoices.status, status));
    if (paymentStatus) conditions.push(eq(invoices.paymentStatus, paymentStatus));
    if (search) conditions.push(or(
      ilike(invoices.invoiceNumber, `%${search}%`),
      ilike(customers.name, `%${search}%`),
      ilike(customers.storeName, `%${search}%`),
      ilike(employees.name, `%${search}%`)
    )!);
    const query = db
      .select({
        invoice: invoices,
        customerName: customers.name,
        customerStore: customers.storeName,
        projectName: projects.name,
        employeeName: employees.name,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(employees, eq(invoices.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(sortExpression, desc(invoices.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [results, [totalRow]] = await Promise.all([
      query,
      db.select({ total: count() }).from(invoices)
        .innerJoin(customers, eq(invoices.customerId, customers.id))
        .leftJoin(projects, eq(invoices.projectId, projects.id))
        .leftJoin(employees, eq(invoices.employeeId, employees.id))
        .where(and(...conditions)),
    ]);
    const formatted = results.map(({ invoice, customerName, customerStore, projectName, employeeName }) => ({
      ...invoice,
      customerName: customerStore ? `${customerName} (${customerStore})` : customerName,
      customerStore: customerStore || null,
      projectName: projectName || "عمومی",
      employeeName: employeeName || "-",
      subtotal: Number(invoice.subtotal),
      grandTotal: Number(invoice.grandTotal),
      cogsTotal: Number(invoice.cogsTotal),
      grossProfitTotal: Number(invoice.grossProfitTotal),
      paidAmount: Number(invoice.paidAmount),
      balanceDue: Number(invoice.balanceDue),
    }));

    const total = Number(totalRow?.total || 0);
    return NextResponse.json({
      success: true,
      invoices: formatted,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.clone().json().catch(() => ({}));
    const context = await requirePermission("invoices.create", body.projectId || null);

    if (!body.customerId || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "انتخاب مشتری و حداقل یک اقلام فاکتور الزامی است." },
        { status: 400 }
      );
    }
    assertUuid(String(body.customerId));
    for (const field of ["projectId", "employeeId", "intermediaryEmployeeId"]) {
      if (body[field]) assertUuid(String(body[field]));
    }
    const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : undefined;
    const dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (invoiceDate && Number.isNaN(invoiceDate.getTime())) throw new ApiError(400, "تاریخ صدور فاکتور نامعتبر است.");
    if (dueDate && Number.isNaN(dueDate.getTime())) throw new ApiError(400, "تاریخ سررسید فاکتور نامعتبر است.");
    // Validation: NaN, Infinity, negative
    for (const item of body.items) {
      const isCustom = Boolean(item.isCustom || !item.productId);
      if (isCustom && !item.productName && !item.productNameSnapshot) {
        return NextResponse.json({ success: false, error: "برای کالای سفارشی / متفرقه، وارد کردن نام کالا الزامی است." }, { status: 400 });
      }
      if (!isCustom && !item.productId) {
        return NextResponse.json({ success: false, error: "شناسه محصول انتخاب شده نامعتبر است." }, { status: 400 });
      }
      const qty = Number(item.quantity);
      const price = item.unitPrice !== undefined ? Number(item.unitPrice) : NaN;
      const disc = Number(item.discountAmount || 0);
      if (!isFinite(qty) || qty <= 0) return NextResponse.json({ success: false, error: "مقدار هر قلم باید بزرگتر از صفر باشد." }, { status: 400 });
      if (item.unitPrice !== undefined && (!isFinite(price) || price < 0)) return NextResponse.json({ success: false, error: "قیمت واحد نامعتبر است." }, { status: 400 });
      if (!isFinite(disc) || disc < 0) return NextResponse.json({ success: false, error: "تخفیف نامعتبر است." }, { status: 400 });
      if (price !== undefined && isFinite(price) && disc > qty * price) return NextResponse.json({ success: false, error: "تخفیف نمی‌تواند بیشتر از مبلغ قلم باشد." }, { status: 400 });
    }
    if (body.invoiceDiscount !== undefined) {
      const d = Number(body.invoiceDiscount);
      if (!isFinite(d) || d < 0) return NextResponse.json({ success: false, error: "تخفیف فاکتور نامعتبر است." }, { status: 400 });
    }
    if (body.taxTotal !== undefined) {
      const t = Number(body.taxTotal);
      if (!isFinite(t) || t < 0) return NextResponse.json({ success: false, error: "مالیات نامعتبر است." }, { status: 400 });
    }
    let initialPayment: { amount: number; accountId: string; paymentMethod: string; referenceNumber?: string; paymentDate?: Date } | undefined;
    if (body.initialPayment) {
      const amt = Number(body.initialPayment.amount);
      if (!Number.isFinite(amt) || amt < 0) throw new ApiError(400, "مبلغ پرداخت اولیه نامعتبر است.");
      if (amt > 0 && !body.initialPayment.accountId) throw new ApiError(400, "انتخاب حساب دریافت برای پرداخت اولیه الزامی است.");
      if (body.initialPayment.accountId) assertUuid(String(body.initialPayment.accountId));
      const paymentDate = body.initialPayment.paymentDate ? new Date(body.initialPayment.paymentDate) : undefined;
      if (paymentDate && Number.isNaN(paymentDate.getTime())) throw new ApiError(400, "تاریخ پرداخت اولیه نامعتبر است.");
      const allowedMethods = new Set(["cash", "pos", "card_transfer", "cheque", "bank_transfer"]);
      const paymentMethod = body.initialPayment.paymentMethod || "pos";
      if (!allowedMethods.has(paymentMethod)) throw new ApiError(400, "روش پرداخت اولیه نامعتبر است.");
      if (amt > 0) {
        const [activeAccount] = await db.select({ id: accounts.id }).from(accounts)
          .where(and(eq(accounts.id, body.initialPayment.accountId), eq(accounts.status, "active"))).limit(1);
        if (!activeAccount) throw new ApiError(404, "حساب دریافت انتخاب‌شده یافت نشد.");
      }
      initialPayment = { amount: amt, accountId: String(body.initialPayment.accountId || ""), paymentMethod, referenceNumber: body.initialPayment.referenceNumber?.trim() || undefined, paymentDate };
    }
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("invoices.manage");

    if (!isManagerOrAdmin && context) {
      const [customer] = await db.select({ assignedEmployeeId: customers.assignedEmployeeId }).from(customers).where(eq(customers.id, body.customerId)).limit(1);
      if (!customer) return NextResponse.json({ success: false, error: "مشتری یافت نشد" }, { status: 404 });
      if (customer.assignedEmployeeId && customer.assignedEmployeeId !== context.employeeId) {
        return NextResponse.json({ success: false, error: "این مشتری متعلق به همکار دیگری است" }, { status: 403 });
      }
    }

    // Determine employeeId:
    // 1. If explicit employeeId is sent in body, use it!
    // 2. If current user is a restricted salesperson, use context.employeeId.
    // 3. Otherwise fallback to customer's assigned visitor or null (direct sale).
    let finalEmployeeId: string | null = null;
    if (isManagerOrAdmin && body.employeeId !== undefined && body.employeeId !== null && body.employeeId !== "") {
      finalEmployeeId = body.employeeId;
    } else if (context && context.employeeId && context.employeeId !== "admin" && !isManagerOrAdmin) {
      finalEmployeeId = context.employeeId;
    } else {
      const [customer] = await db.select({ assignedEmployeeId: customers.assignedEmployeeId }).from(customers).where(eq(customers.id, body.customerId)).limit(1);
      finalEmployeeId = customer?.assignedEmployeeId || null;
    }

    const created = await createInvoice({
      ...requestIdentity(req, context.employeeId, body),
      customerId: body.customerId,
      projectId: body.projectId || null,
      salesMode: body.salesMode || "direct",
      employeeId: finalEmployeeId,
      intermediaryEmployeeId: body.intermediaryEmployeeId || null,
      invoiceDate,
      dueDate,
      invoiceDiscount: body.invoiceDiscount ? Number(body.invoiceDiscount) : 0,
      taxTotal: body.taxTotal ? Number(body.taxTotal) : 0,
      items: body.items,
      initialPayment,
      notes: body.notes,
      manualInvoiceNumber: body.manualInvoiceNumber,
    });

    return NextResponse.json({ success: true, invoice: created });
  } catch (error: any) {
    return apiError(error);
  }
}
