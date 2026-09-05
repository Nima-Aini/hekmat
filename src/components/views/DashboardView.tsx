"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  TrendingUp,
  DollarSign,
  Package,
  Users,
  AlertTriangle,
  Folder,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ShoppingBag,
  Factory
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { toJalaliDate } from "@/lib/dateUtils";

interface DashboardProps {
  selectedProjectId: string | null;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ selectedProjectId, onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [salesReport, setSalesReport] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const projParam = selectedProjectId ? `&projectId=${selectedProjectId}` : "";
      const [dashRes, salesRes, alertRes] = await Promise.all([
        fetch(`/api/reports?type=dashboard${projParam}`).then((r) => r.json()),
        fetch(`/api/reports?type=sales${projParam}`).then((r) => r.json()),
        fetch(`/api/alerts${selectedProjectId ? "?projectId=" + selectedProjectId : ""}`).then((r) => r.json()),
      ]);

      if (dashRes.success) setData(dashRes.data);
      if (salesRes.success) setSalesReport(salesRes.data);
      if (alertRes.success) setAlerts(alertRes.alerts || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedProjectId]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">در حال بارگذاری اطلاعات شاخص‌های عملیاتی...</p>
        </div>
      </div>
    );
  }

  const kpis = data || {
    totalSales: 0,
    totalGrossProfit: 0,
    netProfit: 0,
    grossMarginPercent: 0,
    totalReceivable: 0,
    totalLiquidity: 0,
    totalInventoryValue: 0,
    invoiceCount: 0,
    healthBreakdown: { green: 0, yellow: 0, red: 0 },
  };

  const rawChartData = salesReport?.chartData || [];
  const chartData = rawChartData.map((row: any) => ({
    ...row,
    jalaliDate: row.date ? toJalaliDate(row.date, { persianDigits: false }) : row.date,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Alert Header Banner if active alerts exist */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-rose-200">
                تعداد {alerts.length} هشدار و ناهنجاری عملیاتی در سیستم شناسایی شد!
              </p>
              <p className="text-xs text-rose-300/80">
                شامل کمبود موجودی مواد اولیه، فاکتورهای معوق یا افت سلامت مشتریان.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("alerts")}
            className="w-full rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 transition-all hover:bg-rose-500 sm:w-auto sm:py-1.5"
          >
            مشاهده هشدارها
          </button>
        </div>
      )}

      {/* Executive KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Sales */}
        <div className="mobile-compact-card group min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl transition-all duration-200 hover:border-blue-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">فروش کل (درآمد)</span>
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="kpi-value min-w-0 break-words font-bold tracking-tight text-white">
              {kpis.totalSales.toLocaleString("fa-IR")}{" "}
              <span className="text-xs font-normal text-slate-400">تومان</span>
            </h3>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>تعداد فاکتورها: {kpis.invoiceCount}</span>
            <NeonBadge variant="blue" size="sm">
              عملیاتی
            </NeonBadge>
          </div>
        </div>

        {/* Real Gross Profit */}
        <div className="mobile-compact-card group min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl transition-all duration-200 hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">سود ناخالص (واقعی)</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className={`kpi-value min-w-0 break-words font-bold tracking-tight ${kpis.totalGrossProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {kpis.totalGrossProfit.toLocaleString("fa-IR")}{" "}
              <span className="text-xs font-normal text-slate-400">تومان</span>
            </h3>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">حاشیه سود: {kpis.grossMarginPercent}%</span>
            <NeonBadge variant={kpis.totalGrossProfit >= 0 ? "green" : "red"} size="sm">
              {kpis.totalGrossProfit >= 0 ? "سودده" : "زیان‌ده"}
            </NeonBadge>
          </div>
        </div>

        {/* Net Profit */}
        <div className="mobile-compact-card group min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl transition-all duration-200 hover:border-purple-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">سود خالص نهایی</span>
            <div className="rounded-xl bg-purple-500/10 p-2 text-purple-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className={`kpi-value min-w-0 break-words font-bold tracking-tight ${kpis.netProfit >= 0 ? "text-purple-300" : "text-rose-400"}`}>
              {kpis.netProfit.toLocaleString("fa-IR")}{" "}
              <span className="text-xs font-normal text-slate-400">تومان</span>
            </h3>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>پس از کسر هزینه‌ها</span>
            <NeonBadge variant="purple" size="sm">
              P&L
            </NeonBadge>
          </div>
        </div>

        {/* Liquidity & Receivables */}
        <div className="mobile-compact-card group min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl transition-all duration-200 hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">مطالبات و نقدینگی</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">نقدینگی بانک/صندوق:</span>
              <span className="font-semibold text-emerald-400">{kpis.totalLiquidity.toLocaleString("fa-IR")}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">مطالبات سررسیده:</span>
              <span className="font-semibold text-rose-400">{kpis.totalReceivable.toLocaleString("fa-IR")}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>ارزش انبار: {kpis.totalInventoryValue.toLocaleString("fa-IR")}</span>
            <NeonBadge variant="yellow" size="sm">
              نقدینگی
            </NeonBadge>
          </div>
        </div>
      </div>

      {/* Main Sales & Profit Trend Chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="mobile-compact-card rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white">روند فروش و سود در طول زمان</h3>
              <p className="text-xs text-slate-400">نمودار زمانی بر اساس فاکتورهای صادر شده واقعی سیستم</p>
            </div>
            <NeonBadge variant="blue">نمودار زنده</NeonBadge>
          </div>

          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="jalaliDate" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
                    labelStyle={{ color: "#f8fafc", fontWeight: "bold" }}
                  />
                  <Area type="monotone" dataKey="sales" name="فروش" stroke="#3b82f6" fillOpacity={1} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="profit" name="سود" stroke="#10b981" fillOpacity={1} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                اطلاعات فروش متناظر با فیلتر فعلی یافت نشد.
              </div>
            )}
          </div>
        </div>

        {/* Customer Health Breakdown & Quick Actions */}
        <div className="space-y-6">
          <div className="mobile-compact-card rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-1">وضعیت سلامت مشتریان</h3>
            <p className="text-xs text-slate-400 mb-4">تحلیل خودکار رفتار خرید، سررسید و سودآوری مشتریان</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <NeonBadge variant="green" pulse>
                    سبز (سالم)
                  </NeonBadge>
                </div>
                <span className="text-lg font-bold text-emerald-400">{kpis.healthBreakdown.green} مشتری</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <NeonBadge variant="yellow">زرد (نیازمند توجه)</NeonBadge>
                </div>
                <span className="text-lg font-bold text-amber-400">{kpis.healthBreakdown.yellow} مشتری</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-rose-500/20">
                <div className="flex items-center gap-2">
                  <NeonBadge variant="red" pulse>
                    قرمز (بحرانی / ریزش)
                  </NeonBadge>
                </div>
                <span className="text-lg font-bold text-rose-400">{kpis.healthBreakdown.red} مشتری</span>
              </div>
            </div>

            <button
              onClick={() => onNavigate("customer_map")}
              className="mt-4 w-full rounded-xl bg-blue-600/20 border border-blue-500/40 py-2.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition-all text-center"
            >
              مشاهده مشتریان روی نقشه جغرافیایی
            </button>
          </div>

          {/* Direct Module Action Shortcuts */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
            <h4 className="text-xs font-bold text-slate-300 mb-3">دسترسی سریع عملیاتی</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate("invoices")}
                className="flex items-center gap-2 rounded-xl bg-slate-800/80 p-2.5 text-xs font-medium text-slate-200 hover:bg-blue-600/20 hover:text-blue-300 transition-all"
              >
                <ShoppingBag className="h-4 w-4 text-blue-400" />
                ثبت فاکتور جديد
              </button>
              <button
                onClick={() => onNavigate("raw_materials")}
                className="flex items-center gap-2 rounded-xl bg-slate-800/80 p-2.5 text-xs font-medium text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300 transition-all"
              >
                <Package className="h-4 w-4 text-emerald-400" />
                مواد اولیه
              </button>
              <button
                onClick={() => onNavigate("production")}
                className="flex items-center gap-2 rounded-xl bg-slate-800/80 p-2.5 text-xs font-medium text-slate-200 hover:bg-amber-600/20 hover:text-amber-300 transition-all"
              >
                <Factory className="h-4 w-4 text-amber-400" />
                بچ تولید جدید
              </button>
              <button
                onClick={() => onNavigate("reports")}
                className="flex items-center gap-2 rounded-xl bg-slate-800/80 p-2.5 text-xs font-medium text-slate-200 hover:bg-purple-600/20 hover:text-purple-300 transition-all"
              >
                <TrendingUp className="h-4 w-4 text-purple-400" />
                گزارشات و سود
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
