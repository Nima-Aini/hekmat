import { db } from "@/db";
import {
  employees, customers, invoices, commissionLedger, payments, tasks,
  customerAssignments, customerProjectMemberships, employeeProjectAssignments, projects, projectTargets,
  projectCompensations, employeeAccounts, roles, permissions, rolePermissions, orders,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";

function dateRange(period: string) {
  const now = new Date();
  const start = new Date(now);
  if (period === "year") start.setMonth(0, 1);
  else if (period === "week") start.setDate(now.getDate() - 6);
  else if (period === "today") { start.setHours(0, 0, 0, 0); }
  else start.setDate(1);
  start.setHours(0,0,0,0);
  return { start, end: now };
}

export async function getEmployeeDashboard(employeeId: string, period = "month") {
  const [{ value: sales = "0" } = {}] = await db.select({ value: sql<string>`COALESCE(SUM(${invoices.grandTotal}),0)` }).from(invoices).where(and(eq(invoices.employeeId, employeeId), eq(invoices.status, "issued")));
  const { start, end } = dateRange(period);
  const [{ value: periodSales = "0" } = {}] = await db.select({ value: sql<string>`COALESCE(SUM(${invoices.grandTotal}),0)` }).from(invoices).where(and(eq(invoices.employeeId, employeeId), gte(invoices.invoiceDate, start), lte(invoices.invoiceDate, end), eq(invoices.status, "issued")));
  const [{ value: periodCommission = "0" } = {}] = await db.select({
    value: sql<string>`COALESCE(SUM(CASE WHEN ${commissionLedger.commissionAmount} > 0 AND ${commissionLedger.commissionType} <> 'payout' THEN ${commissionLedger.commissionAmount} ELSE 0 END),0)`
  }).from(commissionLedger).where(and(eq(commissionLedger.employeeId, employeeId), gte(commissionLedger.createdAt, start), lte(commissionLedger.createdAt, end), sql`${commissionLedger.status} <> 'reversed'`));
  const [{ value: paidCommission = "0" } = {}] = await db.select({
    value: sql<string>`COALESCE(SUM(CASE WHEN ${commissionLedger.commissionType} = 'payout' OR ${commissionLedger.commissionAmount} < 0 THEN ABS(${commissionLedger.commissionAmount}) WHEN ${commissionLedger.status} = 'paid' AND ${commissionLedger.paymentId} IS NOT NULL THEN ${commissionLedger.commissionAmount} ELSE 0 END),0)`
  }).from(commissionLedger).where(eq(commissionLedger.employeeId, employeeId));
  const [{ count: customersCount = 0 } = {}] = await db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(eq(customers.assignedEmployeeId, employeeId));
  const [{ count: activeCustomers = 0 } = {}] = await db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(and(eq(customers.assignedEmployeeId, employeeId), eq(customers.status, "active")));
  const [{ count: riskyCustomers = 0 } = {}] = await db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(and(eq(customers.assignedEmployeeId, employeeId), or(eq(customers.healthStatus, "red"), eq(customers.healthStatus, "yellow"))));
  const [{ count: orderCount = 0 } = {}] = await db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(and(eq(orders.employeeId, employeeId), inArray(orders.status, ["open", "ready"])));
  const [{ value: todaySales = "0" } = {}] = await db.select({ value: sql<string>`COALESCE(SUM(${invoices.grandTotal}),0)` }).from(invoices).where(and(eq(invoices.employeeId, employeeId), gte(invoices.invoiceDate, new Date(new Date().setHours(0,0,0,0))), eq(invoices.status, "issued")));
  return {
    sales: Number(sales), periodSales: Number(periodSales), todaySales: Number(todaySales),
    periodCommission: Number(periodCommission), paidCommission: Number(paidCommission),
    unpaidCommission: Math.max(0, Number(periodCommission) - Number(paidCommission)),
    customers: Number(customersCount), activeCustomers: Number(activeCustomers), riskyCustomers: Number(riskyCustomers), orders: Number(orderCount),
  };
}

export async function assignCustomer(customerId: string, employeeId: string | null, projectId: string | null, reason = "manual_assignment", assignedBy = "system") {
  const result = await db.transaction(async (tx: any) => {
    const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId)).for("update").limit(1);
    if (!customer) throw new Error("مشتری پیدا نشد");
    const active = await tx.select().from(customerAssignments).where(and(eq(customerAssignments.customerId, customerId), eq(customerAssignments.status, "active"))).orderBy(desc(customerAssignments.assignedAt));
    const correctActive = active.length === 1 && active[0].employeeId === employeeId && (!projectId || active[0].projectId === projectId);
    if (!correctActive) {
      await tx.update(customerAssignments).set({ endedAt: new Date(), status: "ended" }).where(and(eq(customerAssignments.customerId, customerId), eq(customerAssignments.status, "active")));
      await tx.insert(customerAssignments).values({ customerId, employeeId, projectId, assignmentReason: reason, assignedBy, status: "active" });
    }
    if (customer.assignedEmployeeId !== employeeId) {
      await tx.update(customers).set({ assignedEmployeeId: employeeId, updatedAt: new Date() }).where(eq(customers.id, customerId));
    }
    if (projectId) {
      await tx.insert(customerProjectMemberships).values({ customerId, projectId, assignedAt: new Date() }).onConflictDoNothing();
    }
    return { beforeEmployeeId: customer.assignedEmployeeId, changed: !correctActive || customer.assignedEmployeeId !== employeeId };
  });
  if (result.changed) await logAuditEvent("TRANSFER", "customer", customerId, { before: { employeeId: result.beforeEmployeeId }, after: { employeeId }, projectId, reason });
}

export async function transferCustomers(customerIds: string[], toEmployeeId: string | null, projectId: string | null, reason: string, assignedBy = "system") {
  for (const customerId of customerIds) await assignCustomer(customerId, toEmployeeId, projectId, reason, assignedBy);
  return { transferred: customerIds.length };
}

export async function setupEmployeeAccount(employeeId: string, username: string, passwordHash: string, roleCode = "sales") {
  const [role] = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
  const [account] = await db.insert(employeeAccounts).values({ employeeId, username, passwordHash, roleId: role?.id || null, status: "active" }).onConflictDoUpdate({ target: employeeAccounts.employeeId, set: { username, passwordHash, roleId: role?.id || null, status: "active", updatedAt: new Date() } }).returning();
  return account;
}

export async function employeePermissionSet(employeeId: string) {
  const [account] = await db.select({ roleId: employeeAccounts.roleId }).from(employeeAccounts).where(eq(employeeAccounts.employeeId, employeeId)).limit(1);
  if (!account?.roleId) return [];
  const [role] = await db.select({ code: roles.code }).from(roles).where(eq(roles.id, account.roleId)).limit(1);
  if (role?.code === "admin") return [{ code: "*", name: "همه دسترسی‌ها" }];
  const rows = await db.select({ code: permissions.code, name: permissions.name }).from(rolePermissions).innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)).where(eq(rolePermissions.roleId, account.roleId));
  return rows;
}

export async function getProjectDashboard(projectId: string) {
  const [{ value: sales = "0", profit = "0", invoicesCount = 0 } = {}] = await db.select({ value: sql<string>`COALESCE(SUM(${invoices.grandTotal}),0)`, profit: sql<string>`COALESCE(SUM(${invoices.grossProfitTotal}),0)`, invoicesCount: sql<number>`COUNT(*)` }).from(invoices).where(and(eq(invoices.projectId, projectId), eq(invoices.status, "issued")));
  const customerCountRows = await db.execute(sql`SELECT COUNT(DISTINCT customer_id) AS count FROM customer_project_memberships WHERE project_id = ${projectId}`);
  const customerCount = Number((customerCountRows.rows[0] as { count?: string }).count || 0);
  const [{ value: collected = "0" } = {}] = await db.select({ value: sql<string>`COALESCE(SUM(${payments.amount}),0)` }).from(payments).where(and(eq(payments.projectId, projectId), eq(payments.status, "completed")));
  const [{ value: commission = "0" } = {}] = await db.select({ value: sql<string>`COALESCE(SUM(${commissionLedger.commissionAmount}),0)` }).from(commissionLedger).where(and(eq(commissionLedger.projectId, projectId), sql`${commissionLedger.status} <> 'reversed'`));
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return { project, sales: Number(sales), grossProfit: Number(profit), netProfit: Number(profit) - Number(commission), commission: Number(commission), collected: Number(collected), invoices: Number(invoicesCount), customers: Number(customerCount) };
}
