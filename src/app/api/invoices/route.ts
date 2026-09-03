import { NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceItems, customers, projects, employees, payments } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createInvoice, reverseInvoice } from "@/services/invoice";
import { getEmployeeContext, requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    await requirePermission("invoices.view", new URL(req.url).searchParams.get("projectId"));
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const customerId = searchParams.get("customerId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const offset = (page - 1) * pageSize;

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
      .orderBy(desc(invoices.createdAt))
      .limit(pageSize)
      .offset(offset);

    const results = await query;
    const context = await getEmployeeContext();

    const filtered = results.filter(({ invoice }) => {
      const isManager = !context || context.permissions.has("*") || context.roleCode === "manager" || context.roleCode === "admin" || context.permissions.has("invoices.manage");
      if (!isManager && context && invoice.employeeId !== context.employeeId) return false;
      if (projectId && invoice.projectId !== projectId) return false;
      if (customerId && invoice.customerId !== customerId) return false;
      return true;
    });

    const formatted = filtered.map(({ invoice, customerName, customerStore, projectName, employeeName }) => ({
      ...invoice,
      customerName: customerStore ? `${customerName} (${customerStore})` : customerName,
      projectName: projectName || "عمومی",
      employeeName: employeeName || "-",
      subtotal: Number(invoice.subtotal),
      grandTotal: Number(invoice.grandTotal),
      cogsTotal: Number(invoice.cogsTotal),
      grossProfitTotal: Number(invoice.grossProfitTotal),
      paidAmount: Number(invoice.paidAmount),
      balanceDue: Number(invoice.balanceDue),
    }));

    return NextResponse.json({ success: true, invoices: formatted, pagination: { page, pageSize } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
    if (body.initialPayment) {
      const amt = Number(body.initialPayment.amount);
      if (!isFinite(amt) || amt < 0) return NextResponse.json({ success: false, error: "مبلغ پرداخت نامعتبر است." }, { status: 400 });
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
    if (body.employeeId !== undefined && body.employeeId !== null && body.employeeId !== "") {
      finalEmployeeId = body.employeeId;
    } else if (context && context.employeeId && context.employeeId !== "admin" && !isManagerOrAdmin) {
      finalEmployeeId = context.employeeId;
    } else {
      const [customer] = await db.select({ assignedEmployeeId: customers.assignedEmployeeId }).from(customers).where(eq(customers.id, body.customerId)).limit(1);
      finalEmployeeId = customer?.assignedEmployeeId || null;
    }

    const created = await createInvoice({
      customerId: body.customerId,
      projectId: body.projectId || null,
      salesMode: body.salesMode || "direct",
      employeeId: finalEmployeeId,
      intermediaryEmployeeId: body.intermediaryEmployeeId || null,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      invoiceDiscount: body.invoiceDiscount ? Number(body.invoiceDiscount) : 0,
      taxTotal: body.taxTotal ? Number(body.taxTotal) : 0,
      items: body.items,
      initialPayment: body.initialPayment,
      notes: body.notes,
      manualInvoiceNumber: body.manualInvoiceNumber,
    });

    return NextResponse.json({ success: true, invoice: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
