"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { formatMoney, formatNumber, gregorianToJalali, isJalaliLeapYear, jalaliToGregorian } from "@/lib/dateUtils";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";

type ReportType = "expenses_center" | "products_center" | "customers_center" | "projects_center" | "commissions_center" | "inventory" | "period_comparison";

const reportLabels: Record<ReportType, string> = {
  expenses_center: "هزینه‌ها",
  products_center: "محصولات",
  customers_center: "مشتریان",
  projects_center: "پروژه‌ها",
  commissions_center: "پورسانت‌ها",
  inventory: "انبار و مواد اولیه",
  period_comparison: "مقایسه دو دوره",
};

function jalaliDateToIso(value: string) {
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const date = jalaliToGregorian({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const NumberCard = ({ title, value, money = true }: { title: string; value: number; money?: boolean }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><span className="text-xs text-slate-400">{title}</span><strong className="mt-2 block font-mono text-lg text-cyan-300">{money ? formatMoney(value || 0) : formatNumber(value || 0)}</strong></div>
);

export function AdvancedReportsPanel({ selectedProjectId }: { selectedProjectId: string | null }) {
  const now = gregorianToJalali(new Date());
  const monthLastDay = now.month <= 6 ? 31 : now.month <= 11 ? 30 : isJalaliLeapYear(now.year) ? 30 : 29;
  const previousYearMonthLastDay = now.month <= 6 ? 31 : now.month <= 11 ? 30 : isJalaliLeapYear(now.year - 1) ? 30 : 29;
  const [type, setType] = useState<ReportType>("expenses_center");
  const [start, setStart] = useState(`${now.year}/${String(now.month).padStart(2, "0")}/01`);
  const [end, setEnd] = useState(`${now.year}/${String(now.month).padStart(2, "0")}/${String(monthLastDay).padStart(2, "0")}`);
  const [compareStart, setCompareStart] = useState(`${now.year - 1}/${String(now.month).padStart(2, "0")}/01`);
  const [compareEnd, setCompareEnd] = useState(`${now.year - 1}/${String(now.month).padStart(2, "0")}/${String(previousYearMonthLastDay).padStart(2, "0")}`);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const startDate = jalaliDateToIso(start);
    const endDate = jalaliDateToIso(end);
    if (!startDate || !endDate) return null;
    const params = new URLSearchParams({ type, startDate, endDate });
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    if (type === "period_comparison") {
      const secondStart = jalaliDateToIso(compareStart);
      const secondEnd = jalaliDateToIso(compareEnd);
      if (!secondStart || !secondEnd) return null;
      params.set("compareStartDate", secondStart);
      params.set("compareEndDate", secondEnd);
    }
    return params.toString();
  }, [compareEnd, compareStart, end, selectedProjectId, start, type]);

  const load = useCallback(async () => {
    if (!query) { setError("بازه تاریخ شمسی معتبر وارد کنید."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/reports?${query}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "دریافت گزارش انجام نشد.");
      setData(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "دریافت گزارش انجام نشد."); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  const rows: any[] = Array.isArray(data) ? data : data?.categories || data?.rawMaterials || [];
  const downloadCsv = () => {
    const exportRows = type === "period_comparison" && data ? [{ period: "دوره اصلی", ...(data.periodA || {}) }, { period: "دوره مقایسه", ...(data.periodB || {}) }] : rows;
    if (!exportRows.length) return;
    const headers = [...new Set(exportRows.flatMap((row) => Object.keys(row).filter((key) => typeof row[key] !== "object")))];
    const labels: Record<string, string> = { period: "دوره", category: "دسته", productName: "محصول", customerName: "مشتری", storeName: "فروشگاه", projectName: "پروژه", employeeName: "همکار", total: "جمع", count: "تعداد", revenue: "درآمد", grossProfit: "سود ناخالص", margin: "حاشیه سود", invoiceCount: "تعداد فاکتور", totalSales: "فروش", collected: "وصول", outstanding: "مانده", overdue: "سررسیدگذشته", sales: "فروش", profit: "سود", receivables: "مطالبات", earned: "پورسانت کل", payable: "قابل پرداخت", paid: "پرداخت‌شده", unpaid: "باقی‌مانده" };
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = `\uFEFF${headers.map((header) => escape(labels[header] || header)).join(",")}\n${exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `report-${type}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <section className="mt-8 space-y-4 rounded-3xl border border-cyan-500/20 bg-slate-900/50 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-black text-white"><BarChart3 className="h-5 w-5 text-cyan-400" />تحلیل‌های تخصصی</h2><p className="mt-1 text-xs text-slate-400">تجمیع، فیلتر و محاسبه روی سرور انجام می‌شود.</p></div><div className="flex flex-wrap gap-2"><button onClick={downloadCsv} disabled={loading || (!rows.length && type !== "period_comparison")} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40"><Download className="inline h-4 w-4" /> خروجی CSV</button><button onClick={load} disabled={loading} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"><RefreshCw className={`inline h-4 w-4 ${loading ? "animate-spin" : ""}`} /> بروزرسانی</button></div></div>
    <div className="grid gap-3 md:grid-cols-4">
      <label className="text-xs text-slate-400">نوع گزارش<select value={type} onChange={(event) => setType(event.target.value as ReportType)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white">{Object.entries(reportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <JalaliDatePicker value={jalaliDateToIso(start)} onChange={(_, jalali) => setStart(jalali)} label="شروع شمسی" />
      <JalaliDatePicker value={jalaliDateToIso(end)} onChange={(_, jalali) => setEnd(jalali)} label="پایان شمسی" />
      {type === "period_comparison" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:col-span-2"><JalaliDatePicker value={jalaliDateToIso(compareStart)} onChange={(_, jalali) => setCompareStart(jalali)} label="شروع مقایسه" /><JalaliDatePicker value={jalaliDateToIso(compareEnd)} onChange={(_, jalali) => setCompareEnd(jalali)} label="پایان مقایسه" /></div>}
    </div>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</div>}
    {loading && !data ? <div className="p-10 text-center text-sm text-slate-400"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />در حال محاسبه گزارش…</div> : null}
    {type === "expenses_center" && data && <><div className="grid sm:grid-cols-3"><NumberCard title="کل هزینه دوره" value={data.totalExpense} /></div><ReportTable headers={["دسته", "جمع", "تعداد", "بزرگ‌ترین"]} rows={rows.map((row) => [row.category || "سایر", formatMoney(row.total), row.count, formatMoney(row.largest)])} /></>}
    {type === "products_center" && <ReportTable headers={["محصول", "تعداد فروش", "درآمد", "سود", "حاشیه", "فاکتور"]} rows={rows.map((row) => [row.productName, row.quantitySold, formatMoney(row.revenue), formatMoney(row.grossProfit), `${row.margin}%`, row.invoiceCount])} />}
    {type === "customers_center" && <ReportTable headers={["مشتری/فروشگاه", "فروش", "وصول", "مانده", "سررسید گذشته", "فاکتور"]} rows={rows.map((row) => [row.storeName || row.customerName, formatMoney(row.totalSales), formatMoney(row.collected), formatMoney(row.outstanding), formatMoney(row.overdue), row.invoiceCount])} />}
    {type === "projects_center" && <ReportTable headers={["پروژه", "فروش", "وصول", "مطالبات", "سود", "فاکتور"]} rows={rows.map((row) => [row.projectName, formatMoney(row.sales), formatMoney(row.collected), formatMoney(row.receivables), formatMoney(row.profit), row.invoiceCount])} />}
    {type === "commissions_center" && <ReportTable headers={["همکار", "پورسانت کل", "قابل پرداخت", "پرداخت‌شده", "باقی‌مانده"]} rows={rows.map((row) => [row.employeeName, formatMoney(row.earned), formatMoney(row.payable), formatMoney(row.paid), formatMoney(row.unpaid)])} />}
    {type === "inventory" && data && <><div className="grid gap-3 sm:grid-cols-2"><NumberCard title="ارزش مواد اولیه" value={data.totalRawMaterialValue} /><NumberCard title="تعداد اقلام کم‌موجودی" value={rows.filter((row) => row.isLow).length} money={false} /></div><ReportTable headers={["ماده اولیه", "موجودی", "حداقل", "بهای میانگین", "ارزش", "وضعیت"]} rows={rows.map((row) => [row.name, `${row.stockQuantity} ${row.unit || ""}`, row.minStockQuantity, formatMoney(row.averageCost), formatMoney(row.totalValue), row.isLow ? "نیازمند تأمین" : "عادی"])} /></>}
    {type === "period_comparison" && data && <div className="grid gap-3 md:grid-cols-3"><NumberCard title="فروش دوره اصلی" value={data.periodA?.totalSales} /><NumberCard title="فروش دوره مقایسه" value={data.periodB?.totalSales} /><NumberCard title="تغییر فروش (درصد)" value={data.changes?.totalSales} /></div>}
  </section>;
}

function ReportTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number | null | undefined>> }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[650px] text-xs"><thead className="bg-slate-950 text-slate-400"><tr>{headers.map((header) => <th key={header} className="p-3 text-right">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3 text-slate-200">{cell ?? "—"}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <div className="p-8 text-center text-sm text-slate-500">داده‌ای در این بازه ثبت نشده است.</div>}</div>;
}
