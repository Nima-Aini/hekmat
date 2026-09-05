import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceItems, customers, projects, employees, products, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { reverseInvoice, updateInvoice, deleteInvoice } from "@/services/invoice";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const context = await requirePermission("invoices.view");

    const [inv] = await db
      .select({
        invoice: invoices,
        customerName: customers.name,
        customerStore: customers.storeName,
        customerAddress: customers.address,
        customerMobile: customers.mobile,
        projectName: projects.name,
        employeeName: employees.name,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(employees, eq(invoices.employeeId, employees.id))
      .where(eq(invoices.id, id))
      .limit(1);

    if (!inv) {
      return NextResponse.json({ success: false, error: "فاکتور یافت نشد" }, { status: 404 });
    }

    await requirePermission("invoices.view", inv.invoice.projectId);
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("invoices.manage");
    if (!isManagerOrAdmin && context && inv.invoice.employeeId !== context.employeeId) {
      return NextResponse.json({ success: false, error: "دسترسی به این فاکتور مجاز نیست" }, { status: 403 });
    }

    const items = await db
      .select({
        item: invoiceItems,
        productCode: products.code,
        productUnit: products.unit,
      })
      .from(invoiceItems)
      .leftJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoiceItems.invoiceId, id));

    const invoicePayments = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, id));

    return NextResponse.json({
      success: true,
      invoice: {
        ...inv.invoice,
        customerName: inv.customerName,
        customerStore: inv.customerStore,
        customerAddress: inv.customerAddress,
        customerMobile: inv.customerMobile,
        projectName: inv.projectName,
        employeeName: inv.employeeName,
        subtotal: Number(inv.invoice.subtotal),
        grandTotal: Number(inv.invoice.grandTotal),
        paidAmount: Number(inv.invoice.paidAmount),
        balanceDue: Number(inv.invoice.balanceDue),
      },
      items: items.map(({ item, productCode, productUnit }) => ({
        ...item,
        productCode: productCode || (item.isCustom ? "سفارشی" : "-"),
        productUnit: item.customUnit || productUnit || "عدد",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        lineTotal: Number(item.lineTotal),
      })),
      payments: invoicePayments,
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();
    const context = await requirePermission("invoices.reverse");
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "فاکتور یافت نشد" }, { status: 404 });

    await requirePermission("invoices.reverse", existing.projectId);
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("invoices.manage");
    if (!isManagerOrAdmin && context && existing.employeeId !== context.employeeId) {
      return NextResponse.json({ success: false, error: "دسترسی به این فاکتور مجاز نیست" }, { status: 403 });
    }

    if (body.action === "reverse") {
      const reversed = await reverseInvoice(id, body.reason || "ابطال توسط کاربر");
      return NextResponse.json({ success: true, invoice: reversed });
    }

    return NextResponse.json({ success: false, error: "عملیات نامعتبر" }, { status: 400 });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();
    const context = await requirePermission("invoices.update", body.projectId || null);
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "فاکتور یافت نشد" }, { status: 404 });

    await requirePermission("invoices.update", existing.projectId);
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("invoices.manage");
    if (!isManagerOrAdmin && context && existing.employeeId !== context.employeeId) {
      return NextResponse.json({ success: false, error: "دسترسی به ویرایش این فاکتور مجاز نیست" }, { status: 403 });
    }

    if (!isManagerOrAdmin && ((body.employeeId !== undefined && body.employeeId !== existing.employeeId) || (body.customerId !== undefined && body.customerId !== existing.customerId) || (body.projectId !== undefined && body.projectId !== existing.projectId))) return NextResponse.json({ success: false, error: "تغییر مالکیت فاکتور مجاز نیست." }, { status: 403 });
    const updated = await updateInvoice(id, {
      customerId: body.customerId,
      employeeId: body.employeeId !== undefined ? (body.employeeId || null) : undefined,
      projectId: body.projectId !== undefined ? (body.projectId || null) : undefined,
      manualInvoiceNumber: body.manualInvoiceNumber || body.invoiceNumber,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes,
      invoiceDiscount: body.invoiceDiscount !== undefined ? Number(body.invoiceDiscount) : undefined,
      paymentStatus: body.paymentStatus,
      items: body.items,
    });

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const context = await requirePermission("invoices.delete");
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "فاکتور یافت نشد" }, { status: 404 });

    await requirePermission("invoices.delete", existing.projectId);
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("invoices.manage");
    if (!isManagerOrAdmin && context && existing.employeeId !== context.employeeId) {
      return NextResponse.json({ success: false, error: "دسترسی به حذف این فاکتور مجاز نیست" }, { status: 403 });
    }

    const result = await deleteInvoice(id, "حذف مستقیم فاکتور");
    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    return apiError(error);
  }
}
