import { and, count, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, employees, invoiceItems, invoices, payments } from "@/db/schema";
import { ApiError, apiError, assertUuid, pageNumber } from "@/lib/apiError";
import { requirePermission } from "@/services/access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; assertUuid(id);
    const context = await requirePermission("customers.view");
    const [row] = await db.select({ customer: customers, employeeName: employees.name }).from(customers).leftJoin(employees, eq(customers.assignedEmployeeId, employees.id)).where(eq(customers.id, id)).limit(1);
    if (!row) throw new ApiError(404, "مشتری یافت نشد.");
    if (!context.permissions.has("*") && !context.permissions.has("customers.manage") && row.customer.assignedEmployeeId !== context.employeeId) throw new ApiError(403, "مشاهده این پرونده مشتری مجاز نیست.");
    const { searchParams } = new URL(req.url);
    const page = pageNumber(searchParams.get("invoicePage"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 10, 50);
    const validInvoice = and(eq(invoices.customerId, id), eq(invoices.status, "issued"));
    const [invoiceRows, [totalRow], paymentRows, [metrics], productRows] = await Promise.all([
      db.select().from(invoices).where(validInvoice).orderBy(desc(invoices.invoiceDate)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(invoices).where(validInvoice),
      db.select().from(payments).where(and(eq(payments.customerId, id), eq(payments.status, "completed"))).orderBy(desc(payments.paymentDate)).limit(50),
      db.select({ totalSales: sql<number>`COALESCE(SUM(${invoices.grandTotal}),0)`, totalPaid: sql<number>`COALESCE(SUM(${invoices.paidAmount}),0)`, outstanding: sql<number>`COALESCE(SUM(${invoices.balanceDue}),0)`, grossProfit: sql<number>`COALESCE(SUM(${invoices.grossProfitTotal}),0)`, invoiceCount: count(), lastPurchase: sql<Date | null>`MAX(${invoices.invoiceDate})`, oldestDebt: sql<Date | null>`MIN(CASE WHEN ${invoices.balanceDue} > 0 THEN ${invoices.dueDate} END)`, overdue: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.balanceDue} > 0 AND ${invoices.dueDate} < NOW() THEN ${invoices.balanceDue} ELSE 0 END),0)` }).from(invoices).where(validInvoice),
      db.select({ productName: invoiceItems.productNameSnapshot, quantity: sql<number>`SUM(${invoiceItems.quantity})`, revenue: sql<number>`SUM(${invoiceItems.lineTotal})` }).from(invoiceItems).innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id)).where(validInvoice).groupBy(invoiceItems.productNameSnapshot).orderBy(desc(sql`SUM(${invoiceItems.quantity})`)).limit(10),
    ]);
    const total = Number(totalRow?.total || 0);
    const firstPurchase = total ? await db.select({ date: sql<Date>`MIN(${invoices.invoiceDate})` }).from(invoices).where(validInvoice) : [];
    const spanDays = firstPurchase[0]?.date && metrics?.lastPurchase ? Math.max(1, (new Date(metrics.lastPurchase).getTime() - new Date(firstPurchase[0].date).getTime()) / 86_400_000) : 0;
    return NextResponse.json({ success: true, customer: { ...row.customer, employeeName: row.employeeName || "بدون مسئول فروش" }, summary: { totalSales: Number(metrics?.totalSales || 0), totalPaid: Number(metrics?.totalPaid || 0), outstanding: Number(metrics?.outstanding || 0), overdue: Number(metrics?.overdue || 0), grossProfit: Number(metrics?.grossProfit || 0), invoiceCount: Number(metrics?.invoiceCount || 0), averageInvoice: Number(metrics?.invoiceCount || 0) ? Number(metrics.totalSales) / Number(metrics.invoiceCount) : 0, lastPurchase: metrics?.lastPurchase, oldestDebt: metrics?.oldestDebt, purchaseFrequencyDays: Number(metrics?.invoiceCount || 0) > 1 ? Math.round(spanDays / (Number(metrics.invoiceCount) - 1)) : null, collectionRate: Number(metrics?.totalSales || 0) > 0 ? Math.round((Number(metrics.totalPaid) / Number(metrics.totalSales)) * 1000) / 10 : 0 }, invoices: invoiceRows, invoicePagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, payments: paymentRows, favoriteProducts: productRows.map((product) => ({ ...product, quantity: Number(product.quantity), revenue: Number(product.revenue) })) });
  } catch (error) { return apiError(error); }
}
