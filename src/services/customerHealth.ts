import { db } from "@/db";
import { customers, customerHealthLogs, invoices, alerts } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { logAuditEvent } from "./audit";

export interface HealthBreakdown {
  recencyScore: number; // 0..25 (days since last purchase)
  frequencyScore: number; // 0..20 (invoice count)
  monetaryScore: number; // 0..25 (total purchase volume)
  paymentScore: number; // 0..20 (overdue invoice penalty)
  profitabilityScore: number; // 0..10 (gross margin contribution)
}

/**
 * Recalculates health score for a customer and logs change if status/score changed.
 */
export async function recalculateCustomerHealth(customerId: string): Promise<{
  score: number;
  status: "green" | "yellow" | "red";
  breakdown: HealthBreakdown;
}> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) throw new Error("مشتری یافت نشد");

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const customerInvoices = await db
    .select()
    .from(invoices)
    .where(and(
      eq(invoices.customerId, customerId),
      eq(invoices.status, "issued"),
      sql`${invoices.invoiceDate} >= ${oneYearAgo}`
    ));

  const now = new Date();
  let daysSinceLastPurchase = 999;
  let totalSales = 0;
  let overdueCount = 0;
  let totalProfit = 0;

  for (const inv of customerInvoices) {
    const invDate = new Date(inv.invoiceDate);
    const diffDays = Math.floor((now.getTime() - invDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays < daysSinceLastPurchase) {
      daysSinceLastPurchase = diffDays;
    }
    const gTotal = Number(inv.grandTotal) || 0;
    const profit = Number(inv.grossProfitTotal) || 0;
    totalSales += gTotal;
    totalProfit += profit;

    if (inv.paymentStatus === "overdue" || (inv.dueDate && new Date(inv.dueDate) < now && Number(inv.balanceDue) > 0)) {
      overdueCount++;
    }
  }

  // 1. Recency Score (max 25)
  let recencyScore = 0;
  if (daysSinceLastPurchase <= 7) recencyScore = 25;
  else if (daysSinceLastPurchase <= 14) recencyScore = 20;
  else if (daysSinceLastPurchase <= 30) recencyScore = 15;
  else if (daysSinceLastPurchase <= 60) recencyScore = 10;
  else if (daysSinceLastPurchase <= 90) recencyScore = 5;

  // 2. Frequency Score (max 20)
  const invCount = customerInvoices.length;
  let frequencyScore = 0;
  if (invCount >= 10) frequencyScore = 20;
  else if (invCount >= 5) frequencyScore = 15;
  else if (invCount >= 2) frequencyScore = 10;
  else if (invCount >= 1) frequencyScore = 5;

  // 3. Monetary Score (max 25)
  let monetaryScore = 0;
  if (totalSales >= 100_000_000) monetaryScore = 25;
  else if (totalSales >= 50_000_000) monetaryScore = 20;
  else if (totalSales >= 20_000_000) monetaryScore = 15;
  else if (totalSales >= 5_000_000) monetaryScore = 10;
  else if (totalSales > 0) monetaryScore = 5;

  // 4. Payment Score (max 20, penalty for overdue)
  let paymentScore = 20;
  if (overdueCount === 1) paymentScore = 12;
  else if (overdueCount === 2) paymentScore = 6;
  else if (overdueCount >= 3) paymentScore = 0;

  // 5. Profitability Score (max 10)
  let profitabilityScore = 0;
  if (totalProfit > 10_000_000) profitabilityScore = 10;
  else if (totalProfit > 2_000_000) profitabilityScore = 7;
  else if (totalProfit > 0) profitabilityScore = 4;

  const totalScore = Math.min(100, recencyScore + frequencyScore + monetaryScore + paymentScore + profitabilityScore);

  let newStatus: "green" | "yellow" | "red" = "green";
  if (totalScore < 50) newStatus = "red";
  else if (totalScore < 75) newStatus = "yellow";

  const oldScore = customer.healthScore;
  const oldStatus = customer.healthStatus as "green" | "yellow" | "red";

  const breakdown: HealthBreakdown = {
    recencyScore,
    frequencyScore,
    monetaryScore,
    paymentScore,
    profitabilityScore,
  };

  // Update customer record
  await db
    .update(customers)
    .set({
      healthScore: totalScore,
      healthStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  // If score or status changed, log health log & create alert if health degraded
  if (oldScore !== totalScore || oldStatus !== newStatus) {
    await db.insert(customerHealthLogs).values({
      customerId,
      previousScore: oldScore,
      newScore: totalScore,
      previousStatus: oldStatus,
      newStatus,
      breakdown,
      reason: `محاسبه خودکار سلامت مشتری (${customerInvoices.length} فاکتور)`,
    });

    if (newStatus === "red" || (oldStatus === "green" && newStatus === "yellow")) {
      await db.insert(alerts).values({
        type: "health_red",
        severity: newStatus === "red" ? "critical" : "warning",
        title: `افت سلامت مشتری: ${customer.name}`,
        message: `امتیاز سلامت مشتری ${customer.name} به ${totalScore} (${newStatus === "red" ? "قرمز" : "زرد"}) تغییر یافت.`,
        entityType: "customer",
        entityId: customerId,
        dedupKey: `health_${customerId}_${newStatus}`,
      });
    }
  }

  return { score: totalScore, status: newStatus, breakdown };
}
