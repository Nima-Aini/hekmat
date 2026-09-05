import { apiError, assertUuid } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceItems, commissionLedger, payments, customers, customerProjectMemberships, expenses } from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getProjectDashboard } from "@/services/partner";
import { requirePermission } from "@/services/access";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id); await requirePermission("reports.view", id); const base=await getProjectDashboard(id); const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth()-11,1);
    const monthly=await db.select({month:sql<string>`to_char(date_trunc('month', ${invoices.invoiceDate}),'YYYY-MM')`,sales:sql<string>`COALESCE(SUM(${invoices.grandTotal}),0)`}).from(invoices).where(and(eq(invoices.projectId,id),eq(invoices.status,'issued'),gte(invoices.invoiceDate,start))).groupBy(sql`date_trunc('month', ${invoices.invoiceDate})`).orderBy(sql`date_trunc('month', ${invoices.invoiceDate})`);
    const products=await db.select({name:invoiceItems.productNameSnapshot,sales:sql<string>`COALESCE(SUM(${invoiceItems.lineTotal}),0)`}).from(invoiceItems).innerJoin(invoices,eq(invoiceItems.invoiceId,invoices.id)).where(and(eq(invoices.projectId,id),eq(invoices.status,'issued'),gte(invoices.invoiceDate,start))).groupBy(invoiceItems.productNameSnapshot).orderBy(desc(sql`SUM(${invoiceItems.lineTotal})`)).limit(8);
    const employeeRows=await db.execute(sql`SELECT COALESCE(e.name,'فروش مستقل') AS name, COALESCE(SUM(i.grand_total),0) AS sales FROM invoices i LEFT JOIN employees e ON i.employee_id=e.id WHERE i.project_id=${id} AND i.status='issued' GROUP BY e.name ORDER BY sales DESC LIMIT 10`);
    const health=await db.select({status:customers.healthStatus,count:sql<number>`COUNT(DISTINCT ${customers.id})`}).from(customerProjectMemberships).innerJoin(customers,eq(customerProjectMemberships.customerId,customers.id)).where(eq(customerProjectMemberships.projectId,id)).groupBy(customers.healthStatus);
    const [{value:expense='0'}={}] = await db.select({value:sql<string>`COALESCE(SUM(${expenses.amount}),0)`}).from(expenses).where(eq(expenses.projectId,id));
    const [{value:receivable='0'}={}] = await db.select({value:sql<string>`COALESCE(SUM(${invoices.balanceDue}),0)`}).from(invoices).where(and(eq(invoices.projectId,id),eq(invoices.status,'issued')));
    const [{value:paid='0'}={}] = await db.select({value:sql<string>`COALESCE(SUM(${payments.amount}),0)`}).from(payments).where(and(eq(payments.projectId,id),eq(payments.status,'completed')));
    const [{value:commissionsPaid='0'}={}] = await db.select({value:sql<string>`COALESCE(SUM(${commissionLedger.commissionAmount}),0)`}).from(commissionLedger).where(and(eq(commissionLedger.projectId,id),eq(commissionLedger.status,'paid')));
    return NextResponse.json({success:true,analytics:{base,expense:Number(expense),receivable:Number(receivable),paid:Number(paid),commissionsPaid:Number(commissionsPaid),monthlySales:monthly.map(r=>({month:r.month,sales:Number(r.sales)})),products:products.map(r=>({name:r.name,sales:Number(r.sales)})),employees:employeeRows.rows.map((r:any)=>({name:String(r.name),sales:Number(r.sales)})),health:health.map(r=>({status:r.status,count:Number(r.count)}))}});
  } catch(e){return apiError(e);}
}
