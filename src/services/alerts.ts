import { db } from "@/db";
import { alerts, products, rawMaterials, invoices, customers, projects } from "@/db/schema";
import { eq, and, lt, gt, sql, desc } from "drizzle-orm";
import { formatMoney } from "@/lib/dateUtils";

/**
 * Scans operational database for system health anomalies and generates global alerts.
 */
export async function runAlertsEngineScan() {
  const generatedAlerts = [];

  // 1. Scan Low Stock Raw Materials
  const lowRawMaterials = await db
    .select()
    .from(rawMaterials)
    .where(and(eq(rawMaterials.status, "active"), sql`CAST(${rawMaterials.stockQuantity} AS NUMERIC) <= CAST(${rawMaterials.minStockQuantity} AS NUMERIC)`));

  for (const rm of lowRawMaterials) {
    const dedupKey = `low_rm_${rm.id}`;
    const [existing] = await db.select({ id: alerts.id }).from(alerts).where(eq(alerts.dedupKey, dedupKey)).limit(1);
    if (!existing) {
      const [newAlert] = await db
        .insert(alerts)
        .values({
          type: "raw_material_shortage",
          severity: "critical",
          title: `کمبود ماده اولیه: ${rm.name}`,
          message: `موجودی ماده اولیه "${rm.name}" برابر ${formatMoney(rm.stockQuantity)} ${rm.unit} است که کمتر از حداقل حد مجاز (${formatMoney(rm.minStockQuantity)} ${rm.unit}) می‌باشد.`,
          entityType: "raw_material",
          entityId: rm.id,
          dedupKey,
        })
        .returning();
      generatedAlerts.push(newAlert);
    }
  }

  // 2. Scan Low Stock Products
  const lowProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.status, "active"), sql`CAST(${products.stockQuantity} AS NUMERIC) <= CAST(${products.minStockQuantity} AS NUMERIC)`));

  for (const p of lowProducts) {
    const dedupKey = `low_prod_${p.id}`;
    const [existing] = await db.select({ id: alerts.id }).from(alerts).where(eq(alerts.dedupKey, dedupKey)).limit(1);
    if (!existing) {
      const [newAlert] = await db
        .insert(alerts)
        .values({
          type: "low_stock",
          severity: "warning",
          title: `کمبود موجودی محصول: ${p.name}`,
          message: `موجودی محصول "${p.name}" (${formatMoney(p.stockQuantity)} ${p.unit}) کمتر از حداقل سفارش (${formatMoney(p.minStockQuantity)} ${p.unit}) است.`,
          entityType: "product",
          entityId: p.id,
          dedupKey,
        })
        .returning();
      generatedAlerts.push(newAlert);
    }
  }

  // 3. Scan Overdue Invoices
  const now = new Date();
  const overdueInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      balanceDue: invoices.balanceDue,
      dueDate: invoices.dueDate,
      customerName: customers.name,
      projectId: invoices.projectId,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.status, "issued"), lt(invoices.dueDate, now), gt(invoices.balanceDue, "0")));

  for (const inv of overdueInvoices) {
    const dedupKey = `overdue_inv_${inv.id}`;
    const [existing] = await db.select({ id: alerts.id }).from(alerts).where(eq(alerts.dedupKey, dedupKey)).limit(1);
    if (!existing) {
      const balanceNum = formatMoney(inv.balanceDue);
      const [newAlert] = await db
        .insert(alerts)
        .values({
          type: "overdue_invoice",
          severity: "warning",
          title: `فاکتور سررسید گذشته: #${inv.invoiceNumber}`,
          message: `فاکتور #${inv.invoiceNumber} مشتری "${inv.customerName}" به مبلغ ${balanceNum} تومان سررسید شده و تسویه نشده است.`,
          entityType: "invoice",
          entityId: inv.id,
          projectId: inv.projectId,
          dedupKey,
        })
        .returning();
      generatedAlerts.push(newAlert);
    }
  }

  return generatedAlerts;
}

/**
 * Gets active (non-resolved) alerts with optional scope filtering
 */
export async function getActiveAlerts(projectId?: string | null) {
  const result = await db
    .select()
    .from(alerts)
    .where(eq(alerts.status, "active"))
    .orderBy(desc(alerts.createdAt));

  if (projectId) {
    return result.filter((a) => !a.projectId || a.projectId === projectId);
  }

  return result;
}
