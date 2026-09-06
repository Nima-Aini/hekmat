import { db } from "@/db";
import {
  invoices,
  invoiceItems,
  customers,
  products,
  rawMaterials,
  rawMaterialPriceHistory,
  projects,
  employees,
  payments,
  expenses,
  productionBatches,
  inventoryLedger,
  commissionLedger,
  commissionPaymentAllocations,
  accounts,
  systemSettings
} from "@/db/schema";
import { and, countDistinct, eq, desc, gt, gte, inArray, isNull, lte, ne, notInArray, or, sql } from "drizzle-orm";

export interface ReportFilter {
  startDate?: Date | null;
  endDate?: Date | null;
  projectId?: string | null;
  excludeProjectIds?: string[];
  customerId?: string | null;
  productId?: string | null;
  employeeId?: string | null;
  paymentStatus?: string | null;
  salesMode?: string | null;
}


/**
 * 1. Dashboard Executive KPIs & Overview
 */
export async function getDashboardKPIs(filter: ReportFilter = {}) {
  const invoiceConditions = [eq(invoices.status, "issued")];
  const expenseConditions = [];
  const paymentConditions = [eq(payments.status, "completed"), eq(payments.paymentType, "customer_receipt")];
  if (filter.projectId) { invoiceConditions.push(eq(invoices.projectId, filter.projectId)); expenseConditions.push(eq(expenses.projectId, filter.projectId)); paymentConditions.push(eq(payments.projectId, filter.projectId)); }
  if (filter.excludeProjectIds?.length) {
    invoiceConditions.push(or(isNull(invoices.projectId), notInArray(invoices.projectId, filter.excludeProjectIds))!);
    expenseConditions.push(or(isNull(expenses.projectId), notInArray(expenses.projectId, filter.excludeProjectIds))!);
    paymentConditions.push(or(isNull(payments.projectId), notInArray(payments.projectId, filter.excludeProjectIds))!);
  }
  if (filter.startDate) { invoiceConditions.push(gte(invoices.invoiceDate, filter.startDate)); expenseConditions.push(gte(expenses.expenseDate, filter.startDate)); paymentConditions.push(gte(payments.paymentDate, filter.startDate)); }
  if (filter.endDate) { invoiceConditions.push(lte(invoices.invoiceDate, filter.endDate)); expenseConditions.push(lte(expenses.expenseDate, filter.endDate)); paymentConditions.push(lte(payments.paymentDate, filter.endDate)); }
  const [scopedInvoices, scopedExpenses, scopedPayments, allCustomers, allProducts, allRawMaterials, allAccounts] = await Promise.all([
    db.select().from(invoices).where(and(...invoiceConditions)),
    db.select().from(expenses).where(and(...expenseConditions)),
    db.select().from(payments).where(and(...paymentConditions)),
    db.select().from(customers), db.select().from(products), db.select().from(rawMaterials), db.select().from(accounts).where(eq(accounts.status, "active")),
  ]);

  let totalSales = 0;
  let totalCogs = 0;
  let totalGrossProfit = 0;
  let totalPaid = 0;
  let totalReceivable = 0;

  for (const inv of scopedInvoices) {
    totalSales += Number(inv.grandTotal) || 0;
    totalCogs += Number(inv.cogsTotal) || 0;
    totalGrossProfit += Number(inv.grossProfitTotal) || 0; // Unclamped real gross profit
    totalReceivable += Number(inv.balanceDue) || 0;
  }
  totalPaid = scopedPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  let totalOperatingExpenses = 0;
  for (const exp of scopedExpenses) {
    totalOperatingExpenses += Number(exp.amount) || 0;
  }

  const netProfit = totalGrossProfit - totalOperatingExpenses; // Unclamped real net profit
  const grossMarginPercent = totalSales > 0 ? (totalGrossProfit / totalSales) * 100 : 0;
  const netMarginPercent = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Total cash & bank balance
  let totalLiquidity = 0;
  for (const acc of allAccounts) {
    if (acc.type === "cash" || acc.type === "bank") {
      totalLiquidity += Number(acc.balance) || 0;
    }
  }

  // Inventory valuation
  let totalInventoryValue = 0;
  for (const prod of allProducts) {
    totalInventoryValue += (Number(prod.stockQuantity) || 0) * (Number(prod.calculatedCost) || Number(prod.basePrice) || 0);
  }
  for (const rm of allRawMaterials) {
    totalInventoryValue += (Number(rm.stockQuantity) || 0) * (Number(rm.averageCost) || Number(rm.currentCost) || 0);
  }

  // Customer Health Breakdown scoped to active context
  const greenCustomers = allCustomers.filter((c) => c.healthStatus === "green").length;
  const yellowCustomers = allCustomers.filter((c) => c.healthStatus === "yellow").length;
  const redCustomers = allCustomers.filter((c) => c.healthStatus === "red").length;
  const now = new Date();
  const overdueReceivable = scopedInvoices.filter((invoice) => invoice.dueDate && invoice.dueDate < now).reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);
  const notDueReceivable = Math.max(0, totalReceivable - overdueReceivable);
  const lowRawMaterials = allRawMaterials.filter((item) => item.status === "active" && Number(item.stockQuantity) <= Number(item.minStockQuantity));
  const criticalRawMaterials = lowRawMaterials.filter((item) => Number(item.stockQuantity) <= 0);
  const topShortages = lowRawMaterials.map((item) => ({ id: item.id, name: item.name, stock: Number(item.stockQuantity), minimum: Number(item.minStockQuantity), shortage: Math.max(0, Number(item.minStockQuantity) - Number(item.stockQuantity)) })).sort((a, b) => b.shortage - a.shortage).slice(0, 5);
  let salesChangePercent: number | null = null;
  if (filter.startDate && filter.endDate) {
    const duration = filter.endDate.getTime() - filter.startDate.getTime() + 1;
    const previousEnd = new Date(filter.startDate.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration + 1);
    const previousConditions = [eq(invoices.status, "issued"), gte(invoices.invoiceDate, previousStart), lte(invoices.invoiceDate, previousEnd)];
    if (filter.projectId) previousConditions.push(eq(invoices.projectId, filter.projectId));
    const previousInvoices = await db.select({ grandTotal: invoices.grandTotal }).from(invoices).where(and(...previousConditions));
    const previousSales = previousInvoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0);
    salesChangePercent = previousSales > 0 ? Math.round(((totalSales - previousSales) / previousSales) * 1000) / 10 : totalSales > 0 ? 100 : 0;
  }

  return {
    totalSales,
    totalCogs,
    totalGrossProfit,
    totalOperatingExpenses,
    netProfit,
    grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
    netMarginPercent: Math.round(netMarginPercent * 10) / 10,
    totalPaid,
    totalReceivable,
    totalLiquidity,
    totalInventoryValue,
    invoiceCount: scopedInvoices.length,
    averageInvoiceValue: scopedInvoices.length ? totalSales / scopedInvoices.length : 0,
    salesChangePercent,
    overdueReceivable,
    notDueReceivable,
    collectedInPeriod: totalPaid,
    collectionRate: totalSales > 0 ? Math.round((totalPaid / totalSales) * 1000) / 10 : 0,
    lowRawMaterialCount: lowRawMaterials.length,
    criticalRawMaterialCount: criticalRawMaterials.length,
    rawMaterialInventoryValue: allRawMaterials.reduce((sum, item) => sum + Number(item.stockQuantity || 0) * Number(item.averageCost || item.currentCost || 0), 0),
    topShortages,
    customerCount: allCustomers.length,
    healthBreakdown: { green: greenCustomers, yellow: yellowCustomers, red: redCustomers },
  };
}

/**
 * 2. Sales Report Engine with Time-series, Product/Customer Breakdown & Drill-downs
 */
export async function getSalesReport(filter: ReportFilter = {}) {
  const invoiceConditions = [eq(invoices.status, "issued")];
  if (filter.projectId) invoiceConditions.push(eq(invoices.projectId, filter.projectId));
  if (filter.excludeProjectIds?.length) invoiceConditions.push(or(isNull(invoices.projectId), notInArray(invoices.projectId, filter.excludeProjectIds))!);
  if (filter.customerId) invoiceConditions.push(eq(invoices.customerId, filter.customerId));
  if (filter.employeeId) invoiceConditions.push(eq(invoices.employeeId, filter.employeeId));
  if (filter.salesMode) invoiceConditions.push(eq(invoices.salesMode, filter.salesMode));
  if (filter.paymentStatus) invoiceConditions.push(eq(invoices.paymentStatus, filter.paymentStatus));
  if (filter.startDate) invoiceConditions.push(gte(invoices.invoiceDate, filter.startDate));
  if (filter.endDate) invoiceConditions.push(lte(invoices.invoiceDate, filter.endDate));
  const invoiceList = await db
    .select({
      invoice: invoices,
      customerName: customers.name,
      customerStore: customers.storeName,
      projectName: projects.name,
      employeeName: employees.name,
      employeeRole: employees.role,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(employees, eq(invoices.employeeId, employees.id))
    .where(and(...invoiceConditions))
    .orderBy(desc(invoices.invoiceDate));
  const filtered = invoiceList;

  // Time-series aggregation (by Date YYYY-MM-DD)
  const timeSeriesMap = new Map<string, { date: string; sales: number; profit: number; collected: number; receivable: number; count: number }>();

  let grossSales = 0;
  let totalDiscounts = 0;
  let netSales = 0;
  let totalPaid = 0;
  let totalReceivable = 0;
  let totalProfit = 0;

  for (const { invoice } of filtered) {
    const gTotal = Number(invoice.grandTotal) || 0;
    const sub = Number(invoice.subtotal) || 0;
    const disc = (Number(invoice.lineDiscountsTotal) || 0) + (Number(invoice.invoiceDiscount) || 0);
    const paid = Number(invoice.paidAmount) || 0;
    const rec = Number(invoice.balanceDue) || 0;
    const profit = Number(invoice.grossProfitTotal) || 0;

    grossSales += sub;
    totalDiscounts += disc;
    netSales += gTotal;
    totalPaid += paid;
    totalReceivable += rec;
    totalProfit += profit;

    const dateStr = new Date(invoice.invoiceDate).toISOString().slice(0, 10);
    const existingSeries = timeSeriesMap.get(dateStr) || { date: dateStr, sales: 0, profit: 0, collected: 0, receivable: 0, count: 0 };
    existingSeries.sales += gTotal;
    existingSeries.profit += profit;
    existingSeries.collected += paid;
    existingSeries.receivable += rec;
    existingSeries.count += 1;
    timeSeriesMap.set(dateStr, existingSeries);
  }

  const chartData = Array.from(timeSeriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const commissionRows = filtered.length ? await db.select({ invoiceId: commissionLedger.invoiceId, amount: commissionLedger.commissionAmount })
    .from(commissionLedger).where(and(inArray(commissionLedger.invoiceId, filtered.map((row) => row.invoice.id)), ne(commissionLedger.status, "reversed"))) : [];
  const commissionByInvoice = new Map<string, number>();
  for (const row of commissionRows) if (row.invoiceId) commissionByInvoice.set(row.invoiceId, (commissionByInvoice.get(row.invoiceId) || 0) + Math.max(0, Number(row.amount) || 0));
  const employeeMap = new Map<string, { employeeId: string | null; employeeName: string; role: string; invoiceCount: number; totalSales: number; totalCommission: number; collected: number; outstanding: number }>();
  for (const row of filtered) {
    const key = row.invoice.employeeId || "direct";
    const current = employeeMap.get(key) || { employeeId: row.invoice.employeeId, employeeName: row.employeeName || "فروش مستقیم", role: row.employeeRole || "ویزیتور", invoiceCount: 0, totalSales: 0, totalCommission: 0, collected: 0, outstanding: 0 };
    current.invoiceCount += 1;
    current.totalSales += Number(row.invoice.grandTotal) || 0;
    current.collected += Number(row.invoice.paidAmount) || 0;
    current.outstanding += Number(row.invoice.balanceDue) || 0;
    current.totalCommission += commissionByInvoice.get(row.invoice.id) || 0;
    employeeMap.set(key, current);
  }
  const employeePerformances = Array.from(employeeMap.values()).sort((a, b) => b.totalSales - a.totalSales);

  return {
    kpis: {
      invoiceCount: filtered.length,
      grossSales,
      totalDiscounts,
      netSales,
      totalPaid,
      totalReceivable,
      totalProfit,
      averageInvoiceValue: filtered.length > 0 ? Math.round(netSales / filtered.length) : 0,
    },
    chartData,
    employeePerformances,
    visitorSalesTotal: employeePerformances.filter((row) => row.employeeId).reduce((sum, row) => sum + row.totalSales, 0),
    invoices: filtered.map(({ invoice, customerName, customerStore, projectName, employeeName }) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerName: customerStore ? `${customerName} (${customerStore})` : customerName,
      projectName: projectName || "عمومی",
      employeeName: employeeName || "-",
      salesMode: invoice.salesMode,
      grandTotal: Number(invoice.grandTotal),
      paidAmount: Number(invoice.paidAmount),
      balanceDue: Number(invoice.balanceDue),
      grossProfit: Number(invoice.grossProfitTotal),
      paymentStatus: invoice.paymentStatus,
    })),
  };
}

/**
 * 3. Financial & Profitability Report (Full P&L Waterfall Bridge)
 */
export async function getFinancialProfitReport(filter: ReportFilter = {}) {
  const allInvoices = await db.select().from(invoices);
  const allExpenses = await db.select().from(expenses);
  const allCommissions = await db.select().from(commissionLedger);

  const scopedInvoices = allInvoices.filter((inv) => {
    if (inv.status !== "issued") return false;
    if (filter.projectId && inv.projectId !== filter.projectId) return false;
    if (filter.excludeProjectIds?.includes(inv.projectId || "")) return false;
    if (filter.startDate && new Date(inv.invoiceDate) < filter.startDate) return false;
    if (filter.endDate && new Date(inv.invoiceDate) > filter.endDate) return false;
    return true;
  });

  const scopedExpenses = allExpenses.filter((exp) => {
    if (filter.projectId && exp.projectId !== filter.projectId) return false;
    if (filter.excludeProjectIds?.includes(exp.projectId || "")) return false;
    if (filter.startDate && new Date(exp.expenseDate) < filter.startDate) return false;
    if (filter.endDate && new Date(exp.expenseDate) > filter.endDate) return false;
    return true;
  });

  const scopedCommissions = allCommissions.filter((c) => {
    if (filter.projectId && c.projectId !== filter.projectId) return false;
    if (filter.excludeProjectIds?.includes(c.projectId || "")) return false;
    return true;
  });

  let grossRevenue = 0;
  let totalDiscounts = 0;
  let cogsTotal = 0;

  for (const inv of scopedInvoices) {
    grossRevenue += Number(inv.subtotal) || 0;
    totalDiscounts += (Number(inv.lineDiscountsTotal) || 0) + (Number(inv.invoiceDiscount) || 0);
    cogsTotal += Number(inv.cogsTotal) || 0;
  }

  const netRevenue = grossRevenue - totalDiscounts;
  const grossProfit = netRevenue - cogsTotal; // Real unclamped gross profit

  let operatingExpenses = 0;
  for (const exp of scopedExpenses) {
    // Commission payout expenses are cash-settlement documents for amounts
    // already accrued in commission_ledger; counting both would duplicate cost.
    if (exp.category !== "commission") operatingExpenses += Number(exp.amount) || 0;
  }

  let totalCommissions = 0;
  for (const c of scopedCommissions) {
    if (c.status !== "reversed" && c.commissionType !== "payout" && Number(c.commissionAmount) > 0) {
      totalCommissions += Number(c.commissionAmount) || 0;
    }
  }

  const netProfit = grossProfit - operatingExpenses - totalCommissions;

  // Waterfall Chart Bridge Data
  const waterfallData = [
    { step: "درآمد ناخالص", value: grossRevenue, fill: "#3b82f6" },
    { step: "تخفیفات", value: -totalDiscounts, fill: "#f59e0b" },
    { step: "درآمد خالص", value: netRevenue, fill: "#06b6d4" },
    { step: "بهای تمام شده (COGS)", value: -cogsTotal, fill: "#ef4444" },
    { step: "سود ناخالص", value: grossProfit, fill: "#10b981" },
    { step: "هزینه‌های عملیاتی", value: -operatingExpenses, fill: "#8b5cf6" },
    { step: "پورسانت‌ها", value: -totalCommissions, fill: "#ec4899" },
    { step: "سود خالص نهایی", value: netProfit, fill: netProfit >= 0 ? "#10b981" : "#dc2626" },
  ];

  return {
    kpis: {
      grossRevenue,
      totalDiscounts,
      netRevenue,
      cogsTotal,
      grossProfit,
      operatingExpenses,
      totalCommissions,
      netProfit,
      grossMarginPercent: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0,
      netMarginPercent: netRevenue > 0 ? Math.round((netProfit / netRevenue) * 1000) / 10 : 0,
    },
    waterfallData,
    expenseBreakdown: scopedExpenses,
  };
}

/**
 * 4. Cash Flow & Receivable Aging Report
 */
export async function getCashFlowReport(filter: ReportFilter = {}) {
  const allPayments = await db.select().from(payments);
  const allInvoices = await db.select().from(invoices);
  const allAccounts = await db.select().from(accounts);

  const now = new Date();
  let currentReceivable = 0;
  let aging1to30 = 0;
  let aging31to60 = 0;
  let aging61to90 = 0;
  let aging90plus = 0;

  for (const inv of allInvoices) {
    if (inv.status !== "issued") continue;
    const balance = Number(inv.balanceDue) || 0;
    if (balance <= 0) continue;

    const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate);
    const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays <= 0) {
      currentReceivable += balance;
    } else if (diffDays <= 30) {
      aging1to30 += balance;
    } else if (diffDays <= 60) {
      aging31to60 += balance;
    } else if (diffDays <= 90) {
      aging61to90 += balance;
    } else {
      aging90plus += balance;
    }
  }

  let totalInflow = 0;
  let totalOutflow = 0;

  for (const p of allPayments) {
    if (p.status !== "completed") continue;
    const amt = Number(p.amount) || 0;
    if (p.paymentType === "customer_receipt") {
      totalInflow += amt;
    } else {
      totalOutflow += amt;
    }
  }

  return {
    accounts: allAccounts,
    cashInflow: totalInflow,
    cashOutflow: totalOutflow,
    netCashFlow: totalInflow - totalOutflow,
    agingBuckets: {
      current: currentReceivable,
      days1to30: aging1to30,
      days31to60: aging31to60,
      days61to90: aging61to90,
      days90plus: aging90plus,
      totalOutstanding: currentReceivable + aging1to30 + aging31to60 + aging61to90 + aging90plus,
    },
  };
}

/**
 * 5. Raw Material & Inventory Consumption Report
 */
export async function getInventoryAndRawMaterialReport(filter: ReportFilter = {}) {
  const allRawMaterials = await db.select().from(rawMaterials);
  const allProducts = await db.select().from(products);
  const recentLedger = await db.select().from(inventoryLedger).orderBy(desc(inventoryLedger.createdAt)).limit(100);

  const rawMaterialDetails = [];
  let totalRmValue = 0;

  for (const rm of allRawMaterials) {
    const qty = Number(rm.stockQuantity) || 0;
    const cost = Number(rm.averageCost) || Number(rm.currentCost) || 0;
    const value = qty * cost;
    totalRmValue += value;

    const isLow = qty <= Number(rm.minStockQuantity);

    rawMaterialDetails.push({
      id: rm.id,
      code: rm.code,
      name: rm.name,
      unit: rm.unit,
      stockQuantity: qty,
      minStockQuantity: Number(rm.minStockQuantity),
      currentCost: Number(rm.currentCost),
      averageCost: Number(rm.averageCost),
      totalValue: value,
      isLow,
      status: rm.status,
    });
  }

  const productMap = new Map(allProducts.map((p) => [p.id, p]));
  const rmMap = new Map(allRawMaterials.map((rm) => [rm.id, rm]));

  const formattedLedger = recentLedger.map((l) => {
    const isProd = l.itemType === "product";
    const item = isProd ? productMap.get(l.itemId) : rmMap.get(l.itemId);
    return {
      ...l,
      itemName: item ? item.name : (isProd ? "محصول نامشخص" : "ماده اولیه نامشخص"),
      itemCode: item?.code || "-",
      unit: item?.unit || "-",
    };
  });

  return {
    totalRawMaterialValue: totalRmValue,
    rawMaterials: rawMaterialDetails,
    products: allProducts.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      unit: p.unit,
      stockQuantity: Number(p.stockQuantity),
      calculatedCost: Number(p.calculatedCost),
      basePrice: Number(p.basePrice),
      totalValue: (Number(p.stockQuantity) || 0) * (Number(p.calculatedCost) || Number(p.basePrice) || 0),
    })),
    recentLedger: formattedLedger,
  };
}

/**
 * 6. Project Comparison Engine (Project A vs Project B)
 */
export async function getProjectComparisonReport(projectAId: string, projectBId: string, filter: ReportFilter = {}) {
  const reportA = await getDashboardKPIs({ projectId: projectAId, startDate: filter.startDate, endDate: filter.endDate });
  const reportB = await getDashboardKPIs({ projectId: projectBId, startDate: filter.startDate, endDate: filter.endDate });

  const [projectA] = await db.select().from(projects).where(eq(projects.id, projectAId)).limit(1);
  const [projectB] = await db.select().from(projects).where(eq(projects.id, projectBId)).limit(1);

  return {
    projectA: { info: projectA, kpis: reportA },
    projectB: { info: projectB, kpis: reportB },
  };
}

/**
 * 7. Internal tax-preparation report. This is not an official declaration.
 */
export async function getTaxDeclarationReport(filter: ReportFilter = {}) {
  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "main_config")).limit(1);

  const allInvoices = await db.select().from(invoices);
  const allExpenses = await db.select().from(expenses);
  const allCommissions = await db.select().from(commissionLedger);

  const scopedInvoices = allInvoices.filter((inv) => {
    if (inv.status !== "issued") return false;
    if (filter.projectId && inv.projectId !== filter.projectId) return false;
    if (filter.excludeProjectIds?.includes(inv.projectId || "")) return false;
    if (filter.startDate && new Date(inv.invoiceDate) < filter.startDate) return false;
    if (filter.endDate && new Date(inv.invoiceDate) > filter.endDate) return false;
    return true;
  });

  const scopedExpenses = allExpenses.filter((exp) => {
    if (filter.projectId && exp.projectId !== filter.projectId) return false;
    if (filter.excludeProjectIds?.includes(exp.projectId || "")) return false;
    if (filter.startDate && new Date(exp.expenseDate) < filter.startDate) return false;
    if (filter.endDate && new Date(exp.expenseDate) > filter.endDate) return false;
    return true;
  });

  const scopedCommissions = allCommissions.filter((c) => {
    if (filter.projectId && c.projectId !== filter.projectId) return false;
    if (filter.excludeProjectIds?.includes(c.projectId || "")) return false;
    if (filter.startDate && new Date(c.createdAt) < filter.startDate) return false;
    if (filter.endDate && new Date(c.createdAt) > filter.endDate) return false;
    return true;
  });

  let grossSales = 0;
  let totalDiscounts = 0;
  let totalCogs = 0;
  let vatCollected = 0;
  let totalPaid = 0;
  let totalReceivable = 0;

  for (const inv of scopedInvoices) {
    grossSales += Number(inv.subtotal) || 0;
    totalDiscounts += (Number(inv.lineDiscountsTotal) || 0) + (Number(inv.invoiceDiscount) || 0);
    totalCogs += Number(inv.cogsTotal) || 0;
    vatCollected += Number(inv.taxTotal) || 0;
    totalPaid += Number(inv.paidAmount) || 0;
    totalReceivable += Number(inv.balanceDue) || 0;
  }

  const netSalesRevenue = grossSales - totalDiscounts;
  const grossProfit = netSalesRevenue - totalCogs;

  let totalExpenses = 0;
  const expenseByCategory: { [key: string]: number } = {};
  for (const exp of scopedExpenses) {
    const amt = Number(exp.amount) || 0;
    totalExpenses += amt;
    const cat = exp.category || "سایر هزینه‌های اداری و عمومی";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amt;
  }

  let totalCommissions = 0;
  for (const c of scopedCommissions) {
    if (c.status !== "reversed" && c.commissionType !== "payout" && Number(c.commissionAmount) > 0) totalCommissions += Number(c.commissionAmount) || 0;
  }

  // Expense eligibility is a legal/documentary determination. Do not label all
  // application expenses as tax-allowable or add commission a second time.
  const totalAllowableDeductions = totalExpenses;
  const taxableOperatingProfit = grossProfit - totalExpenses;

  const corporateTaxRate = Number(settings?.taxRateCorporate) || 25;
  const vatRate = Number(settings?.vatRate) || 10;

  const corporateTaxAmount = taxableOperatingProfit > 0 ? Math.round((taxableOperatingProfit * corporateTaxRate) / 100) : 0;
  const calculatedVat = vatCollected;
  const estimatedVatAtConfiguredRate = Math.round((netSalesRevenue * vatRate) / 100);
  const netRetainedProfit = taxableOperatingProfit - corporateTaxAmount;

  return {
    taxpayer: {
      businessName: settings?.businessName || "شرکت مهندسی و بازرگانی حکمت اکما",
      economicCode: settings?.economicCode || "-",
      nationalId: settings?.nationalId || "-",
      registrationNumber: settings?.registrationNumber || "-",
      postalCode: settings?.postalCode || "-",
      companyAddress: settings?.companyAddress || "-",
      companyPhone: settings?.companyPhone || "-",
      taxOffice: settings?.taxOffice || "اداره امور مالیاتی",
      corporateTaxRate,
      vatRate,
      taxpayerType: settings?.taxpayerType || "legal",
    },
    period: {
      startDate: filter.startDate ? filter.startDate.toISOString() : null,
      endDate: filter.endDate ? filter.endDate.toISOString() : null,
    },
    statement: {
      invoiceCount: scopedInvoices.length,
      expenseCount: scopedExpenses.length,
      grossSales,
      totalDiscounts,
      netSalesRevenue,
      totalCogs,
      grossProfit,
      totalExpenses,
      totalCommissions,
      totalAllowableDeductions,
      taxableOperatingProfit,
      corporateTaxAmount,
      corporateTaxRate,
      calculatedVat,
      vatCollected,
      estimatedVatAtConfiguredRate,
      vatRate,
      netRetainedProfit,
      totalPaid,
      totalReceivable,
    },
    expenseBreakdown: Object.entries(expenseByCategory).map(([category, amount]) => ({ category, amount })),
    recentInvoices: scopedInvoices.slice(0, 50).map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      grandTotal: Number(inv.grandTotal),
      cogsTotal: Number(inv.cogsTotal),
      grossProfit: Number(inv.grossProfitTotal),
      paymentStatus: inv.paymentStatus,
    })),
  };
}

function validInvoiceConditions(filter: ReportFilter) {
  const conditions = [eq(invoices.status, "issued")];
  if (filter.projectId) conditions.push(eq(invoices.projectId, filter.projectId));
  if (filter.startDate) conditions.push(gte(invoices.invoiceDate, filter.startDate));
  if (filter.endDate) conditions.push(lte(invoices.invoiceDate, filter.endDate));
  return conditions;
}

export async function getExpenseCenterReport(filter: ReportFilter = {}) {
  const conditions = [];
  if (filter.projectId) conditions.push(eq(expenses.projectId, filter.projectId));
  if (filter.startDate) conditions.push(gte(expenses.expenseDate, filter.startDate));
  if (filter.endDate) conditions.push(lte(expenses.expenseDate, filter.endDate));
  const rows = await db.select({ category: expenses.category, total: sql<number>`COALESCE(SUM(${expenses.amount}),0)`, count: sql<number>`COUNT(*)`, largest: sql<number>`COALESCE(MAX(${expenses.amount}),0)` }).from(expenses).where(and(...conditions)).groupBy(expenses.category).orderBy(desc(sql`SUM(${expenses.amount})`));
  return { totalExpense: rows.reduce((sum, row) => sum + Number(row.total), 0), categories: rows.map((row) => ({ ...row, total: Number(row.total), count: Number(row.count), largest: Number(row.largest) })) };
}

export async function getProductCenterReport(filter: ReportFilter = {}) {
  const conditions = validInvoiceConditions(filter);
  if (filter.productId) conditions.push(eq(invoiceItems.productId, filter.productId));
  const rows = await db.select({ productId: invoiceItems.productId, productName: invoiceItems.productNameSnapshot, quantitySold: sql<number>`SUM(${invoiceItems.quantity})`, revenue: sql<number>`SUM(${invoiceItems.lineTotal})`, cogs: sql<number>`SUM(${invoiceItems.lineCogs})`, grossProfit: sql<number>`SUM(${invoiceItems.lineProfit})`, averagePrice: sql<number>`AVG(${invoiceItems.unitPrice})`, invoiceCount: countDistinct(invoiceItems.invoiceId), customerCount: countDistinct(invoices.customerId) }).from(invoiceItems).innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id)).where(and(...conditions)).groupBy(invoiceItems.productId, invoiceItems.productNameSnapshot).orderBy(desc(sql`SUM(${invoiceItems.lineTotal})`));
  return rows.map((row) => { const revenue = Number(row.revenue); const profit = Number(row.grossProfit); return { ...row, quantitySold: Number(row.quantitySold), revenue, cogs: Number(row.cogs), grossProfit: profit, averagePrice: Number(row.averagePrice), invoiceCount: Number(row.invoiceCount), customerCount: Number(row.customerCount), margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0 }; });
}

export async function getCustomerCenterReport(filter: ReportFilter = {}, customerIds: string[] = []) {
  const conditions = validInvoiceConditions(filter);
  if (customerIds.length) conditions.push(inArray(invoices.customerId, customerIds));
  const rows = await db.select({ customerId: customers.id, customerName: customers.name, storeName: customers.storeName, totalSales: sql<number>`SUM(${invoices.grandTotal})`, invoiceCount: sql<number>`COUNT(*)`, collected: sql<number>`SUM(${invoices.paidAmount})`, outstanding: sql<number>`SUM(${invoices.balanceDue})`, overdue: sql<number>`SUM(CASE WHEN ${invoices.balanceDue} > 0 AND ${invoices.dueDate} < NOW() THEN ${invoices.balanceDue} ELSE 0 END)`, grossProfit: sql<number>`SUM(${invoices.grossProfitTotal})`, lastPurchase: sql<Date>`MAX(${invoices.invoiceDate})` }).from(invoices).innerJoin(customers, eq(invoices.customerId, customers.id)).where(and(...conditions)).groupBy(customers.id, customers.name, customers.storeName).orderBy(desc(sql`SUM(${invoices.grandTotal})`));
  return rows.map((row) => ({ ...row, totalSales: Number(row.totalSales), invoiceCount: Number(row.invoiceCount), collected: Number(row.collected), outstanding: Number(row.outstanding), overdue: Number(row.overdue), grossProfit: Number(row.grossProfit), averageInvoice: Number(row.invoiceCount) ? Number(row.totalSales) / Number(row.invoiceCount) : 0 }));
}

export async function getProjectCenterReport(filter: ReportFilter = {}) {
  const conditions = validInvoiceConditions(filter);
  const rows = await db.select({ projectId: projects.id, projectName: projects.name, sales: sql<number>`SUM(${invoices.grandTotal})`, profit: sql<number>`SUM(${invoices.grossProfitTotal})`, collected: sql<number>`SUM(${invoices.paidAmount})`, receivables: sql<number>`SUM(${invoices.balanceDue})`, invoiceCount: sql<number>`COUNT(*)` }).from(invoices).leftJoin(projects, eq(invoices.projectId, projects.id)).where(and(...conditions)).groupBy(projects.id, projects.name).orderBy(desc(sql`SUM(${invoices.grandTotal})`));
  return rows.map((row) => ({ ...row, projectName: row.projectName || "عمومی", sales: Number(row.sales), profit: Number(row.profit), collected: Number(row.collected), receivables: Number(row.receivables), invoiceCount: Number(row.invoiceCount) }));
}

export async function getCommissionCenterReport(filter: ReportFilter = {}) {
  const conditions = [ne(commissionLedger.status, "reversed"), gt(commissionLedger.commissionAmount, "0")];
  if (filter.projectId) conditions.push(eq(commissionLedger.projectId, filter.projectId));
  if (filter.startDate) conditions.push(gte(commissionLedger.createdAt, filter.startDate));
  if (filter.endDate) conditions.push(lte(commissionLedger.createdAt, filter.endDate));
  const rows = await db.select({ commission: commissionLedger, employeeName: employees.name, invoiceTotal: invoices.grandTotal, invoicePaid: invoices.paidAmount, invoiceStatus: invoices.status }).from(commissionLedger).innerJoin(employees, eq(commissionLedger.employeeId, employees.id)).leftJoin(invoices, eq(commissionLedger.invoiceId, invoices.id)).where(and(...conditions));
  const ids = rows.map((row) => row.commission.id);
  const allocations = ids.length ? await db.select().from(commissionPaymentAllocations).where(inArray(commissionPaymentAllocations.commissionLedgerId, ids)) : [];
  const paidById = new Map<string, number>();
  for (const allocation of allocations) paidById.set(allocation.commissionLedgerId, (paidById.get(allocation.commissionLedgerId) || 0) + Number(allocation.amount));
  const byEmployee = new Map<string, { employeeId: string; employeeName: string; earned: number; payable: number; paid: number; unpaid: number }>();
  for (const row of rows) {
    const amount = Number(row.commission.commissionAmount);
    const ratio = row.invoiceStatus === "issued" && Number(row.invoiceTotal) > 0 ? Math.min(1, Math.max(0, Number(row.invoicePaid) / Number(row.invoiceTotal))) : 0;
    const payable = Math.round(amount * ratio * 100) / 100;
    const allocated = paidById.get(row.commission.id) || (row.commission.paymentId || row.commission.status === "paid" ? amount : 0);
    const current = byEmployee.get(row.commission.employeeId) || { employeeId: row.commission.employeeId, employeeName: row.employeeName, earned: 0, payable: 0, paid: 0, unpaid: 0 };
    current.earned += amount; current.payable += payable; current.paid += allocated; current.unpaid += Math.max(0, payable - allocated); byEmployee.set(current.employeeId, current);
  }
  return Array.from(byEmployee.values()).sort((a, b) => b.earned - a.earned);
}

export async function getPeriodComparisonReport(first: ReportFilter, second: ReportFilter) {
  const [periodA, periodB] = await Promise.all([getDashboardKPIs(first), getDashboardKPIs(second)]);
  const keys = ["totalSales", "collectedInPeriod", "totalGrossProfit", "netProfit", "totalOperatingExpenses", "invoiceCount", "averageInvoiceValue"] as const;
  const changes = Object.fromEntries(keys.map((key) => { const a = Number(periodA[key] || 0); const b = Number(periodB[key] || 0); return [key, b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : a ? 100 : 0]; }));
  return { periodA, periodB, changes };
}
