"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { AlertTriangle, CheckCircle, RefreshCw, Filter } from "lucide-react";
import { toJalaliDate } from "@/lib/dateUtils";

export function getAlertNavigation(alert: { entityType?: string | null; entityId?: string | null }) {
  const tabByType: Record<string, string> = {
    invoice: "invoices", raw_material: "raw_materials", product: "products",
    customer: "customers", employee: "employees", project: "projects", order: "orders", note: "notes",
  };
  if (!alert.entityType || !alert.entityId || !tabByType[alert.entityType]) return null;
  return { tab: tabByType[alert.entityType], type: alert.entityType, id: alert.entityId };
}

export const AlertsView: React.FC<{ selectedProjectId: string | null; onNavigate?: (tab: string) => void }> = ({ selectedProjectId, onNavigate }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [status, setStatus] = useState("unresolved");
  const [severity, setSeverity] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", status, sortBy });
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      if (severity) params.set("severity", severity);
      const res = await fetch(`/api/alerts?${params}`).then((r) => r.json());
      if (res.success) { setAlerts(res.alerts || []); setPagination(res.pagination || { total: 0, totalPages: 1 }); }
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedProjectId, page, status, severity, sortBy]);

  const handleResolve = async (event: React.MouseEvent, alertId: string) => {
    event.stopPropagation();
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", alertId }),
      }).then((r) => r.json());

      if (res.success) {
        fetchAlerts();
      }
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  const handleAlertClick = (alert: any) => {
    const navigation = getAlertNavigation(alert);
    if (!navigation) return;
    onNavigate?.(navigation.tab);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("akma:navigate-item", {
      detail: { type: navigation.type, id: navigation.id },
    })), 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
            مرکز اعلانات و پایش ناهنجاری‌های سیستم (Alerts Center)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            شناسایی خودکار کمبود موجودی، فاکتورهای سررسید گذشته، افت سلامت مشتریان و انحرافات مالی
          </p>
        </div>

        <button onClick={fetchAlerts} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:text-white">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:grid-cols-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-xl bg-slate-950 p-2.5 text-xs"><option value="unresolved">حل‌نشده</option><option value="resolved">حل‌شده / بسته‌شده</option><option value="all">همه اعلان‌ها</option></select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className="rounded-xl bg-slate-950 p-2.5 text-xs"><option value="">همه شدت‌ها</option><option value="critical">بحرانی</option><option value="warning">هشدار</option><option value="info">اطلاعاتی</option></select>
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="rounded-xl bg-slate-950 p-2.5 text-xs"><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="severity">شدت</option></select>
      </div>

      <div className="space-y-3">
        {loading && alerts.length === 0 ? <div className="rounded-2xl border border-slate-800 p-12 text-center text-slate-400"><RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />در حال پایش و دریافت اعلان‌ها…</div> : alerts.length > 0 ? (
          alerts.map((a) => (
            <div
              key={a.id}
              onClick={() => handleAlertClick(a)}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl flex items-start justify-between gap-4 cursor-pointer hover:border-purple-500/50"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`h-5 w-5 mt-0.5 ${
                    a.severity === "critical" ? "text-rose-400 animate-pulse" : "text-amber-400"
                  }`}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{a.title}</h3>
                    <NeonBadge variant={a.severity === "critical" ? "red" : "yellow"} size="sm">
                      {a.severity === "critical" ? "بحرانی" : "هشدار"}
                    </NeonBadge>
                  </div>
                  <p className="text-xs text-slate-300">{a.message}</p>
                  <p className="text-[10px] text-slate-500">{toJalaliDate(a.createdAt, { showTime: true })}</p>
                </div>
              </div>

              {a.status !== "resolved" ? (
                <button
                  onClick={(event) => handleResolve(event, a.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-all shrink-0"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  برطرف شد
                </button>
              ) : (
                <NeonBadge variant="gray">برطرف شده</NeonBadge>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-slate-500 text-sm">
            هیچ هشدار فعالی در سیستم وجود ندارد. تمامی شاخص‌های عملیاتی و انبار در وضعیت متوازن قرار دارند.
          </div>
        )}
      </div>
      {pagination.totalPages > 1 && <div className="flex justify-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-30">قبلی</button><span className="p-2 text-xs">{page.toLocaleString("fa-IR")} / {pagination.totalPages.toLocaleString("fa-IR")}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-30">بعدی</button></div>}
    </div>
  );
};
