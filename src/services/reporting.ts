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
  accounts,
  systemSettings
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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
  const allInvoices = await db.select().from(invoices);
  const allExpenses = await db.select().from(expenses);
  const allCustomers = await db.select().from(customers);
  const allProducts = await db.select().from(products);
  const allRawMaterials = await db.select().from(rawMaterials);
  const allAccounts = await db.select().from(accounts);

  // Apply project filter in memory for consistency across all entities
  const scopedInvoices = allInvoices.filter((inv) => {
    if (inv.status === "reversed") return false;
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

  let totalSales = 0;
  let totalCogs = 0;
  let totalGrossProfit = 0;
  let totalPaid = 0;
  let totalReceivable = 0;

  for (const inv of scopedInvoices) {
    totalSales += Number(inv.grandTotal) || 0;
    totalCogs += Number(inv.cogsTotal) || 0;
    totalGrossProfit += Number(inv.grossProfitTotal) || 0; // Unclamped real gross profit
    totalPaid += Number(inv.paidAmount) || 0;
    totalReceivable += Number(inv.balanceDue) || 0;
  }

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
    customerCount: allCustomers.length,
    healthBreakdown: { green: greenCustomers, yellow: yellowCustomers, red: redCustomers },
  };
}

/**
 * 2. Sales Report Engine with Time-series, Product/Customer Breakdown & Drill-downs
 */
export async function getSalesReport(filter: ReportFilter = {}) {
  const invoiceList = await db
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
    .orderBy(desc(invoices.invoiceDate));

  const filtered = invoiceList.filter(({ invoice }) => {
    if (invoice.status === "reversed") return false;
    if (filter.projectId && invoice.projectId !== filter.projectId) return false;
    if (filter.excludeProjectIds?.includes(invoice.projectId || "")) return false;
    if (filter.customerId && invoice.customerId !== filter.customerId) return false;
    if (filter.employeeId && invoice.employeeId !== filter.employeeId) return false;
    if (filter.salesMode && invoice.salesMode !== filter.salesMode) return false;
    if (filter.paymentStatus && invoice.paymentStatus !== filter.paymentStatus) return false;
    if (filter.startDate && new Date(invoice.invoiceDate) < filter.startDate) return false;
    if (filter.endDate && new Date(invoice.invoiceDate) > filter.endDate) return false;
    return true;
  });

  // Time-series aggregation (by Date YYYY-MM-DD)
  const timeSeriesMap = new Map<string, { date: string; sales: number; profit: number; count: number }>();

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
    const existingSeries = timeSeriesMap.get(dateStr) || { date: dateStr, sales: 0, profit: 0, count: 0 };
    existingSeries.sales += gTotal;
    existingSeries.profit += profit;
    existingSeries.count += 1;
    timeSeriesMap.set(dateStr, existingSeries);
  }

  const chartData = Array.from(timeSeriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

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
    if (inv.status === "reversed") return false;
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
    operatingExpenses += Number(exp.amount) || 0;
  }

  let totalCommissions = 0;
  for (const c of scopedCommissions) {
    if (c.status !== "reversed") {
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
    if (inv.status === "reversed") continue;
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
 * 7. Official Tax Declaration Report (گزارش اظهارنامه مالیاتی رسمی)
 */
export async function getTaxDeclarationReport(filter: ReportFilter = {}) {
  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "main_config")).limit(1);

  const allInvoices = await db.select().from(invoices);
  const allExpenses = await db.select().from(expenses);
  const allCommissions = await db.select().from(commissionLedger);

  const scopedInvoices = allInvoices.filter((inv) => {
    if (inv.status === "reversed") return false;
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
    totalCommissions += Number(c.commissionAmount) || 0;
  }

  const totalAllowableDeductions = totalExpenses + totalCommissions;
  const taxableOperatingProfit = grossProfit - totalAllowableDeductions;

  const corporateTaxRate = Number(settings?.taxRateCorporate) || 25;
  const vatRate = Number(settings?.vatRate) || 10;

  const corporateTaxAmount = taxableOperatingProfit > 0 ? Math.round((taxableOperatingProfit * corporateTaxRate) / 100) : 0;
  const calculatedVat = Math.round((netSalesRevenue * vatRate) / 100);
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
