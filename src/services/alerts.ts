import { db } from "@/db";
import { alerts, products, rawMaterials, invoices, customers, tasks, orders, orderItems } from "@/db/schema";
import { eq, and, lt, gt, sql, desc, inArray, or } from "drizzle-orm";
import { formatMoney } from "@/lib/dateUtils";
import { getEndOfDayJalali } from "@/lib/dateUtils";

/**
 * Scans operational database for system health anomalies and generates global alerts.
 */
export async function runAlertsEngineScan() {
  const generatedAlerts: Array<typeof alerts.$inferSelect> = [];

  const createOrReopen = async (values: typeof alerts.$inferInsert) => {
    const [existing] = await db.select().from(alerts).where(eq(alerts.dedupKey, values.dedupKey!)).limit(1);
    if (!existing) {
      const [created] = await db.insert(alerts).values(values).returning();
      generatedAlerts.push(created);
      return created;
    }
    // An explicit user resolution is respected while the same condition remains.
    // Automatically closed alerts may be reopened when their condition returns.
    if (existing.status === "auto_closed") {
      const [reopened] = await db.update(alerts).set({ ...values, status: "new", updatedAt: new Date() }).where(eq(alerts.id, existing.id)).returning();
      generatedAlerts.push(reopened);
      return reopened;
    }
    return existing;
  };

  // 1. Scan Low Stock Raw Materials
  const lowRawMaterials = await db
    .select()
    .from(rawMaterials)
    .where(and(eq(rawMaterials.status, "active"), sql`CAST(${rawMaterials.stockQuantity} AS NUMERIC) <= CAST(${rawMaterials.minStockQuantity} AS NUMERIC)`));

  for (const rm of lowRawMaterials) {
    const dedupKey = `low_rm_${rm.id}`;
    await createOrReopen({
          type: "raw_material_shortage",
          severity: "critical",
          title: `کمبود ماده اولیه: ${rm.name}`,
          message: `موجودی ماده اولیه "${rm.name}" برابر ${formatMoney(rm.stockQuantity)} ${rm.unit} است که کمتر از حداقل حد مجاز (${formatMoney(rm.minStockQuantity)} ${rm.unit}) می‌باشد.`,
          entityType: "raw_material",
          entityId: rm.id,
          dedupKey,
        });
  }
  const activeRawAlerts = await db.select({ id: alerts.id, entityId: alerts.entityId }).from(alerts).where(and(eq(alerts.type, "raw_material_shortage"), inArray(alerts.status, ["new", "active", "in_review"])));
  const lowRawIds = new Set(lowRawMaterials.map((item) => item.id));
  const staleRawAlerts = activeRawAlerts.filter((alert) => !alert.entityId || !lowRawIds.has(alert.entityId)).map((alert) => alert.id);
  if (staleRawAlerts.length) await db.update(alerts).set({ status: "auto_closed", updatedAt: new Date() }).where(inArray(alerts.id, staleRawAlerts));

  // 2. Scan Low Stock Products
  const lowProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.status, "active"), sql`CAST(${products.stockQuantity} AS NUMERIC) <= CAST(${products.minStockQuantity} AS NUMERIC)`));

  for (const p of lowProducts) {
    const dedupKey = `low_prod_${p.id}`;
    await createOrReopen({
          type: "low_stock",
          severity: "warning",
          title: `کمبود موجودی محصول: ${p.name}`,
          message: `موجودی محصول "${p.name}" (${formatMoney(p.stockQuantity)} ${p.unit}) کمتر از حداقل سفارش (${formatMoney(p.minStockQuantity)} ${p.unit}) است.`,
          entityType: "product",
          entityId: p.id,
          dedupKey,
        });
  }
  const activeProductAlerts = await db.select({ id: alerts.id, entityId: alerts.entityId }).from(alerts).where(and(eq(alerts.type, "low_stock"), inArray(alerts.status, ["new", "active", "in_review"])));
  const lowProductIds = new Set(lowProducts.map((item) => item.id));
  const staleProductAlerts = activeProductAlerts.filter((alert) => !alert.entityId || !lowProductIds.has(alert.entityId)).map((alert) => alert.id);
  if (staleProductAlerts.length) await db.update(alerts).set({ status: "auto_closed", updatedAt: new Date() }).where(inArray(alerts.id, staleProductAlerts));

  // 3. Scan Overdue Invoices
  const now = new Date();
  const overdueInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      balanceDue: invoices.balanceDue,
      dueDate: invoices.dueDate,
      customerName: customers.name,
      storeName: customers.storeName,
      projectId: invoices.projectId,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.status, "issued"), lt(invoices.dueDate, now), gt(invoices.balanceDue, "0")));

  for (const inv of overdueInvoices) {
    const dedupKey = `overdue_inv_${inv.id}`;
    {
      const balanceNum = formatMoney(inv.balanceDue);
      await createOrReopen({
          type: "overdue_invoice",
          severity: "warning",
          title: `فاکتور سررسید گذشته: #${inv.invoiceNumber}`,
          message: `فاکتور #${inv.invoiceNumber} فروشگاه «${inv.storeName || inv.customerName}» به مبلغ ${balanceNum} تومان سررسید شده و هنوز تسویه نشده است.`,
          entityType: "invoice",
          entityId: inv.id,
          projectId: inv.projectId,
          dedupKey,
        });
    }
  }

  // Keep history, but automatically close overdue alerts whose invoice is no longer overdue.
  const activeOverdue = await db.select({ id: alerts.id, entityId: alerts.entityId }).from(alerts)
    .where(and(eq(alerts.type, "overdue_invoice"), inArray(alerts.status, ["new", "active", "in_review"])));
  const overdueIds = overdueInvoices.map((invoice) => invoice.id);
  const staleIds = activeOverdue
    .filter((alert) => !alert.entityId || !overdueIds.includes(alert.entityId))
    .map((alert) => alert.id);
  if (staleIds.length > 0) {
    await db.update(alerts).set({ status: "auto_closed", updatedAt: new Date() }).where(inArray(alerts.id, staleIds));
  }

  // 4. Notes due within two days. Existing alert history is reused by dedup key.
  const reminderLimit = new Date(now.getTime() + 2 * 86_400_000);
  const dueNotes = await db.select().from(tasks).where(and(eq(tasks.entityType, "note"), eq(tasks.status, "pending"), sql`${tasks.dueDate} IS NOT NULL`, sql`${tasks.dueDate} <= ${reminderLimit}`));
  for (const note of dueNotes) {
    const overdue = note.dueDate ? note.dueDate.getTime() < now.getTime() : false;
    const dueToday = note.dueDate ? note.dueDate.getTime() <= getEndOfDayJalali(now).getTime() : false;
    const timing = overdue ? "از موعد آن گذشته است." : dueToday ? "امروز سررسید می‌شود." : "تا دو روز دیگر سررسید می‌شود.";
    await createOrReopen({ type: "note_due", severity: dueToday ? "warning" : "info", title: overdue ? "یادداشت سررسید گذشته" : dueToday ? "موعد یادداشت امروز است" : "یادداشت نزدیک سررسید", message: `یادداشت «${note.title}» ${timing}`, entityType: "note", entityId: note.id, projectId: note.projectId, dedupKey: `note_due_${note.id}` });
  }
  const activeNoteAlerts = await db.select({ id: alerts.id, entityId: alerts.entityId }).from(alerts).where(and(eq(alerts.type, "note_due"), inArray(alerts.status, ["new", "active", "in_review"])));
  const dueNoteIds = new Set(dueNotes.map((note) => note.id));
  const staleNoteIds = activeNoteAlerts.filter((alert) => !alert.entityId || !dueNoteIds.has(alert.entityId)).map((alert) => alert.id);
  if (staleNoteIds.length) await db.update(alerts).set({ status: "auto_closed", updatedAt: new Date() }).where(inArray(alerts.id, staleNoteIds));

  // 5. An order becomes ready when every requested product is currently available.
  const pendingOrders = await db.select().from(orders).where(inArray(orders.status, ["open", "ready"]));
  const pendingOrderIds = pendingOrders.map((order) => order.id);
  const availability = pendingOrderIds.length ? await db.select({ item: orderItems, stock: products.stockQuantity }).from(orderItems).innerJoin(products, eq(orderItems.productId, products.id)).where(inArray(orderItems.orderId, pendingOrderIds)) : [];
  const readyOrderIds: string[] = [];
  for (const order of pendingOrders) {
    const lines = availability.filter((row) => row.item.orderId === order.id);
    const ready = lines.length > 0 && lines.every((row) => Number(row.stock) >= Number(row.item.quantity));
    if (ready) {
      readyOrderIds.push(order.id);
      if (order.status !== "ready") await db.update(orders).set({ status: "ready", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await createOrReopen({ type: "order_ready", severity: "info", title: `سفارش آماده: ${order.orderNumber}`, message: `سفارش ${order.orderNumber} آماده تکمیل است؛ موجودی تمام اقلام کافی است.`, entityType: "order", entityId: order.id, projectId: order.projectId, dedupKey: `order_ready_${order.id}` });
    } else if (order.status === "ready") await db.update(orders).set({ status: "open", updatedAt: new Date() }).where(eq(orders.id, order.id));
  }
  const activeOrderAlerts = await db.select({ id: alerts.id, entityId: alerts.entityId }).from(alerts).where(and(eq(alerts.type, "order_ready"), inArray(alerts.status, ["new", "active", "in_review"])));
  const readySet = new Set(readyOrderIds);
  const staleOrderAlerts = activeOrderAlerts.filter((alert) => !alert.entityId || !readySet.has(alert.entityId)).map((alert) => alert.id);
  if (staleOrderAlerts.length) await db.update(alerts).set({ status: "auto_closed", updatedAt: new Date() }).where(inArray(alerts.id, staleOrderAlerts));

  return generatedAlerts;
}

/**
 * Gets active (non-resolved) alerts with optional scope filtering
 */
export async function getActiveAlerts(projectId?: string | null) {
  const result = await db
    .select()
    .from(alerts)
    .where(and(inArray(alerts.status, ["new", "active", "in_review"]), projectId ? or(sql`${alerts.projectId} IS NULL`, eq(alerts.projectId, projectId)) : undefined))
    .orderBy(desc(alerts.createdAt));

  return result;
}
