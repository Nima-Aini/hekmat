"use client";

import { BadgeDollarSign, CircleDollarSign, FileText, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, toJalaliDate } from "@/lib/dateUtils";

export type AnalyticsTab = "summary" | "sales" | "financial" | "customers" | "products" | "projects" | "inventory" | "employees" | "comparison" | "inflation" | "tax_declaration";

type Props = {
  activeTab: AnalyticsTab;
  financialData: any;
  salesData: any;
  dashboardData: any;
  products: any[];
  customers: any[];
  projects: any[];
  expenses: any;
  commissions: any[];
  inventory: any;
};

const money = (value: unknown) => formatMoney(Number(value || 0));

function KpiCard({ label, value, caption, tone = "cyan", icon: Icon }: { label: string; value: string; caption?: string; tone?: "cyan" | "blue" | "emerald" | "purple" | "amber" | "rose"; icon: any }) {
  const tones = { cyan: "border-cyan-500/20 text-cyan-300 bg-cyan-500/10", blue: "border-blue-500/20 text-blue-300 bg-blue-500/10", emerald: "border-emerald-500/20 text-emerald-300 bg-emerald-500/10", purple: "border-purple-500/20 text-purple-300 bg-purple-500/10", amber: "border-amber-500/20 text-amber-300 bg-amber-500/10", rose: "border-rose-500/20 text-rose-300 bg-rose-500/10" } as const;
  return <article className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-black/10">
    <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-medium text-slate-400">{label}</span><span className={`rounded-xl border p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div>
    <strong className="mt-3 block min-w-0 break-words text-lg font-black tracking-tight text-white sm:text-xl">{value}</strong>
    {caption && <p className="mt-1 truncate text-[10px] text-slate-500">{caption}</p>}
  </article>;
}

function RankedList({ title, rows, empty = "داده‌ای در این بازه ثبت نشده است." }: { title: string; rows: Array<{ id: string; label: string; value: string; meta?: string }>; empty?: string }) {
  return <article className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4"><h3 className="text-sm font-bold text-white">{title}</h3><div className="mt-4 space-y-2.5">{rows.slice(0, 5).map((row, index) => <div key={row.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/45 p-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-[11px] font-black text-cyan-300">{(index + 1).toLocaleString("fa-IR")}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-200">{row.label}</p>{row.meta && <p className="mt-0.5 truncate text-[10px] text-slate-500">{row.meta}</p>}</div><strong className="shrink-0 text-[11px] text-emerald-300">{row.value}</strong></div>)}{rows.length === 0 && <p className="py-8 text-center text-xs text-slate-500">{empty}</p>}</div></article>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[680px] text-xs"><thead className="bg-slate-950 text-slate-400"><tr>{headers.map((header) => <th key={header} className="p-3 text-right">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map((row, index) => <tr key={index} className="hover:bg-slate-900/70">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3 text-slate-200">{cell}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-xs text-slate-500">داده‌ای در این بازه ثبت نشده است.</p>}</div>;
}

function MiniBarPanel({ title, rows }: { title: string; rows: Array<{ name: string; value: number }> }) {
  return <article className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4"><h3 className="text-sm font-bold text-white">{title}</h3><div className="mt-3 h-52">{rows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rows.slice(0, 5)} layout="vertical" margin={{ left: 4, right: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#243248" /><XAxis type="number" stroke="#94a3b8" fontSize={9} /><YAxis type="category" dataKey="name" width={72} stroke="#94a3b8" fontSize={9} /><Tooltip contentStyle={{ background: "#07111f", border: "1px solid #334155", borderRadius: 12 }} formatter={(value) => money(value)} /><Bar dataKey="value" fill="#14b8a6" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer> : <p className="py-16 text-center text-xs text-slate-500">داده‌ای در این بازه ثبت نشده است.</p>}</div></article>;
}

function CategoryPanel({ title, subtitle, kpis, chartRows, chartKey, chartLabel, list, headers, rows }: { title: string; subtitle: string; kpis: Array<{ label: string; value: string; caption?: string }>; chartRows: any[]; chartKey: string; chartLabel: string; list: Array<{ id: string; label: string; value: string; meta?: string }>; headers: string[]; rows: Array<Array<string | number>> }) {
  return <section className="space-y-5"><div><h3 className="text-lg font-black text-white">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis.map((item, index) => <KpiCard key={item.label} label={item.label} value={item.value} caption={item.caption} tone={(["cyan", "emerald", "purple", "amber"] as const)[index % 4]} icon={index % 2 ? TrendingUp : CircleDollarSign} />)}</div><div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]"><div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4"><h4 className="mb-4 text-sm font-bold text-white">{chartLabel}</h4><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows.slice(0, 8)}><CartesianGrid strokeDasharray="3 3" stroke="#243248" opacity={0.7} /><XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ background: "#07111f", border: "1px solid #334155", borderRadius: 12 }} formatter={(value) => money(value)} /><Bar dataKey={chartKey} fill="#06b6d4" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div></div><RankedList title="رتبه‌بندی برتر" rows={list} /></div><DataTable headers={headers} rows={rows} /></section>;
}

export function ReportsAnalyticsOverview(props: Props) {
  const { activeTab, financialData, salesData, dashboardData, products, customers, projects, expenses, commissions, inventory } = props;
  const financial = financialData?.kpis || {};
  const sales = salesData?.kpis || {};
  const chartData = (salesData?.chartData || []).map((row: any) => ({ ...row, label: row.date ? toJalaliDate(row.date, { persianDigits: false }) : row.date }));
  const expenseRows = expenses?.categories || [];
  const inventoryRows = inventory?.rawMaterials || [];

  if (activeTab === "summary") return <section className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
      <KpiCard label="فروش خالص" value={money(sales.netSales)} caption={`${Number(sales.invoiceCount || 0).toLocaleString("fa-IR")} فاکتور معتبر`} tone="blue" icon={BadgeDollarSign} />
      <KpiCard label="سود ناخالص" value={money(financial.grossProfit)} caption={`حاشیه ${Number(financial.grossMarginPercent || 0).toLocaleString("fa-IR")}%`} tone="emerald" icon={TrendingUp} />
      <KpiCard label="سود خالص" value={money(financial.netProfit)} caption={`حاشیه ${Number(financial.netMarginPercent || 0).toLocaleString("fa-IR")}%`} tone="purple" icon={CircleDollarSign} />
      <KpiCard label="مطالبات" value={money(sales.totalReceivable)} caption="مانده فاکتورهای معتبر" tone="rose" icon={FileText} />
      <KpiCard label="وصول" value={money(sales.totalPaid)} caption="وصول در بازه گزارش" tone="cyan" icon={BadgeDollarSign} />
      <KpiCard label="تعداد فاکتور" value={Number(sales.invoiceCount || 0).toLocaleString("fa-IR")} caption="فاکتور صادرشده" tone="blue" icon={FileText} />
      <KpiCard label="میانگین فاکتور" value={money(sales.averageInvoiceValue)} caption="میانگین ارزش هر فاکتور" tone="amber" icon={TrendingUp} />
      <KpiCard label="نرخ وصول" value={`${Number(dashboardData?.collectionRate || (sales.netSales ? (sales.totalPaid / sales.netSales) * 100 : 0)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}%`} caption="وصول به فروش" tone="emerald" icon={CircleDollarSign} />
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <article className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4"><div className="mb-4"><h3 className="text-sm font-bold text-white">روند فروش و سود</h3><p className="mt-1 text-[10px] text-slate-500">عملکرد زمانی فاکتورهای معتبر در بازه انتخاب‌شده</p></div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="reportSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient><linearGradient id="reportProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#243248" /><XAxis dataKey="label" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ background: "#07111f", border: "1px solid #334155", borderRadius: 12 }} formatter={(value) => money(value)} /><Area type="monotone" dataKey="sales" name="فروش" stroke="#3b82f6" fill="url(#reportSales)" /><Area type="monotone" dataKey="profit" name="سود" stroke="#10b981" fill="url(#reportProfit)" /></AreaChart></ResponsiveContainer></div></article>
      <article className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4"><div className="mb-4"><h3 className="text-sm font-bold text-white">مقایسه عملکرد پروژه‌ها</h3><p className="mt-1 text-[10px] text-slate-500">فروش در برابر سود ناخالص</p></div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={projects.slice(0, 7)}><CartesianGrid strokeDasharray="3 3" stroke="#243248" /><XAxis dataKey="projectName" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ background: "#07111f", border: "1px solid #334155", borderRadius: 12 }} formatter={(value) => money(value)} /><Bar dataKey="sales" name="فروش" fill="#3b82f6" radius={[7, 7, 0, 0]} /><Bar dataKey="profit" name="سود" fill="#14b8a6" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div></article>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <MiniBarPanel title="وصول در برابر مطالبات" rows={[{ name: "وصول", value: Number(sales.totalPaid || 0) }, { name: "مطالبات", value: Number(sales.totalReceivable || 0) }]} />
      <MiniBarPanel title="سهم مشتریان برتر" rows={customers.map((row) => ({ name: row.storeName || row.customerName, value: Number(row.totalSales || 0) }))} />
      <MiniBarPanel title="سهم محصولات برتر" rows={products.map((row) => ({ name: row.productName, value: Number(row.revenue || 0) }))} />
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <RankedList title="مشتریان با بیشترین بدهی" rows={customers.slice().sort((a, b) => Number(b.outstanding) - Number(a.outstanding)).map((row) => ({ id: row.customerId, label: row.storeName || row.customerName, value: money(row.outstanding), meta: `سررسیدگذشته: ${money(row.overdue)}` }))} />
      <RankedList title="کارکنان برتر" rows={(salesData?.employeePerformances || []).map((row: any) => ({ id: row.employeeId || row.employeeName, label: row.employeeName, value: money(row.totalSales), meta: `${Number(row.invoiceCount || 0).toLocaleString("fa-IR")} فاکتور` }))} />
      <RankedList title="هزینه‌های مهم" rows={expenseRows.map((row: any) => ({ id: row.category || "other", label: row.category || "سایر", value: money(row.total), meta: `${Number(row.count || 0).toLocaleString("fa-IR")} ثبت` }))} />
      <RankedList title="هشدارهای موجودی" rows={inventoryRows.filter((row: any) => row.isLow).map((row: any) => ({ id: row.id, label: row.name, value: `${Number(row.stockQuantity).toLocaleString("fa-IR")} ${row.unit || ""}`, meta: `حداقل ${Number(row.minStockQuantity).toLocaleString("fa-IR")}` }))} empty="کمبود موجودی فعالی وجود ندارد." />
    </div>
  </section>;

  if (activeTab === "customers") return <CategoryPanel title="تحلیل مشتریان" subtitle="فروش، وصول و مانده مشتریان در بازه گزارش" kpis={[{ label: "تعداد مشتری فعال", value: customers.length.toLocaleString("fa-IR") }, { label: "فروش مشتریان", value: money(customers.reduce((sum, row) => sum + Number(row.totalSales), 0)) }, { label: "وصول", value: money(customers.reduce((sum, row) => sum + Number(row.collected), 0)) }, { label: "مطالبات", value: money(customers.reduce((sum, row) => sum + Number(row.outstanding), 0)) }]} chartRows={customers.map((row) => ({ name: row.storeName || row.customerName, value: row.totalSales }))} chartKey="value" chartLabel="مقایسه فروش مشتریان" list={customers.map((row) => ({ id: row.customerId, label: row.storeName || row.customerName, value: money(row.totalSales), meta: `${row.invoiceCount} فاکتور` }))} headers={["مشتری / فروشگاه", "فروش", "وصول", "مانده", "سررسید گذشته", "فاکتور"]} rows={customers.map((row) => [row.storeName || row.customerName, money(row.totalSales), money(row.collected), money(row.outstanding), money(row.overdue), row.invoiceCount])} />;
  if (activeTab === "products") return <CategoryPanel title="تحلیل محصولات" subtitle="ترکیب فروش، سود و حاشیه محصولات" kpis={[{ label: "محصول فروخته‌شده", value: products.length.toLocaleString("fa-IR") }, { label: "درآمد محصولات", value: money(products.reduce((sum, row) => sum + Number(row.revenue), 0)) }, { label: "سود ناخالص", value: money(products.reduce((sum, row) => sum + Number(row.grossProfit), 0)) }, { label: "تعداد فروش", value: Number(products.reduce((sum, row) => sum + Number(row.quantitySold), 0)).toLocaleString("fa-IR") }]} chartRows={products.map((row) => ({ name: row.productName, value: row.revenue }))} chartKey="value" chartLabel="محصولات بر اساس درآمد" list={products.map((row) => ({ id: row.productId, label: row.productName, value: money(row.revenue), meta: `حاشیه ${row.margin}%` }))} headers={["محصول", "تعداد", "درآمد", "سود", "حاشیه", "فاکتور"]} rows={products.map((row) => [row.productName, row.quantitySold, money(row.revenue), money(row.grossProfit), `${row.margin}%`, row.invoiceCount])} />;
  if (activeTab === "projects") return <CategoryPanel title="تحلیل پروژه‌ها" subtitle="مقایسه فروش، سود، وصول و مطالبات پروژه‌ها" kpis={[{ label: "پروژه دارای فروش", value: projects.length.toLocaleString("fa-IR") }, { label: "فروش پروژه‌ها", value: money(projects.reduce((sum, row) => sum + Number(row.sales), 0)) }, { label: "سود پروژه‌ها", value: money(projects.reduce((sum, row) => sum + Number(row.profit), 0)) }, { label: "مطالبات", value: money(projects.reduce((sum, row) => sum + Number(row.receivables), 0)) }]} chartRows={projects.map((row) => ({ name: row.projectName, value: row.sales }))} chartKey="value" chartLabel="مقایسه فروش پروژه‌ها" list={projects.map((row) => ({ id: row.projectId || row.projectName, label: row.projectName, value: money(row.sales), meta: `سود ${money(row.profit)}` }))} headers={["پروژه", "فروش", "وصول", "مطالبات", "سود", "فاکتور"]} rows={projects.map((row) => [row.projectName, money(row.sales), money(row.collected), money(row.receivables), money(row.profit), row.invoiceCount])} />;
  if (activeTab === "inventory") return <CategoryPanel title="تحلیل انبار" subtitle="وضعیت جاری ارزش و سطح موجودی مواد اولیه" kpis={[{ label: "ارزش مواد اولیه", value: money(inventory?.totalRawMaterialValue) }, { label: "تعداد مواد", value: inventoryRows.length.toLocaleString("fa-IR") }, { label: "زیر حداقل", value: inventoryRows.filter((row: any) => row.isLow).length.toLocaleString("fa-IR") }, { label: "بدون موجودی", value: inventoryRows.filter((row: any) => Number(row.stockQuantity) <= 0).length.toLocaleString("fa-IR") }]} chartRows={inventoryRows.map((row: any) => ({ name: row.name, value: row.totalValue }))} chartKey="value" chartLabel="ارزش مواد اولیه" list={inventoryRows.slice().sort((a: any, b: any) => Number(a.stockQuantity) - Number(b.stockQuantity)).map((row: any) => ({ id: row.id, label: row.name, value: `${Number(row.stockQuantity).toLocaleString("fa-IR")} ${row.unit || ""}`, meta: row.isLow ? "نیازمند تأمین" : "موجودی عادی" }))} headers={["ماده اولیه", "موجودی", "حداقل", "بهای میانگین", "ارزش", "وضعیت"]} rows={inventoryRows.map((row: any) => [row.name, `${row.stockQuantity} ${row.unit || ""}`, row.minStockQuantity, money(row.averageCost), money(row.totalValue), row.isLow ? "نیازمند تأمین" : "عادی"])} />;
  if (activeTab === "employees") return <CategoryPanel title="کارکنان و ویزیتورها" subtitle="فروش، وصول و پورسانت کارکنان در بازه گزارش" kpis={[{ label: "همکار دارای فروش", value: (salesData?.employeePerformances || []).length.toLocaleString("fa-IR") }, { label: "فروش ویزیتوری", value: money(salesData?.visitorSalesTotal) }, { label: "پورسانت ثبت‌شده", value: money(commissions.reduce((sum, row) => sum + Number(row.earned), 0)) }, { label: "پورسانت پرداخت‌نشده", value: money(commissions.reduce((sum, row) => sum + Number(row.unpaid), 0)) }]} chartRows={(salesData?.employeePerformances || []).map((row: any) => ({ name: row.employeeName, value: row.totalSales }))} chartKey="value" chartLabel="مقایسه فروش کارکنان" list={(salesData?.employeePerformances || []).map((row: any) => ({ id: row.employeeId || row.employeeName, label: row.employeeName, value: money(row.totalSales), meta: `${row.invoiceCount} فاکتور` }))} headers={["همکار", "سمت", "فاکتور", "فروش", "وصول", "پورسانت"]} rows={(salesData?.employeePerformances || []).map((row: any) => [row.employeeName, row.role || "ویزیتور", row.invoiceCount, money(row.totalSales), money(row.collected), money(row.totalCommission)])} />;
  return null;
}
