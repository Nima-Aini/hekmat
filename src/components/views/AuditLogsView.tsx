"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowUpLeft, Eye, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { toJalaliDate } from "@/lib/dateUtils";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_NAVIGATION,
  auditActionLabel,
  auditEntityLabel,
  getAuditDetailRows,
  getAuditSummary,
} from "@/lib/auditPresentation";

interface AuditLog {
  id: string;
  userName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export function AuditLogsView({ selectedProjectId, onNavigate }: { selectedProjectId?: string | null; onNavigate?: (tab: string) => void }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: "", action: "", entityType: "", startDate: "", endDate: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const response = await fetch(`/api/audit-logs?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "دریافت تاریخچه فعالیت‌ها انجام نشد.");
      setLogs(data.logs || []);
      setPagination(data.pagination || { total: 0, totalPages: 1 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت تاریخچه فعالیت‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, selectedProjectId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!selectedLog) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelectedLog(null);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selectedLog]);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const openEntity = (log: AuditLog) => {
    const tab = AUDIT_NAVIGATION[log.entityType];
    if (!tab || !log.entityId || !onNavigate) return;
    onNavigate(tab);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("akma:navigate-item", { detail: { type: log.entityType, id: log.entityId } })), 50);
  };

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="flex items-center gap-2 text-xl font-black"><ShieldCheck className="h-6 w-6 text-cyan-400" />تاریخچه فعالیت‌ها</h2><p className="mt-1 text-xs leading-5 text-slate-400">رویدادها فقط خواندنی‌اند و هر اصلاح به‌صورت رویداد جدید ثبت می‌شود.</p></div>
      <span className="text-xs text-slate-500">{pagination.total.toLocaleString("fa-IR")} رویداد</span>
    </div>

    <div className="grid min-w-0 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" /><input value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="کاربر، شماره یا شرح…" className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-9 text-base sm:text-sm" /></div>
      <select value={filters.action} onChange={(event) => setFilter("action", event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-base sm:text-sm"><option value="">همه عملیات‌ها</option>{Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select value={filters.entityType} onChange={(event) => setFilter("entityType", event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-base sm:text-sm"><option value="">همه بخش‌ها</option>{Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <JalaliDatePicker value={filters.startDate || null} onChange={(date) => setFilter("startDate", date ? date.toISOString().slice(0, 10) : "")} placeholder="از تاریخ" />
      <JalaliDatePicker value={filters.endDate || null} onChange={(date) => setFilter("endDate", date ? date.toISOString().slice(0, 10) : "")} placeholder="تا تاریخ" />
    </div>

    {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300"><span>{error}</span><button onClick={load} className="rounded-lg border border-rose-400/30 px-3 py-1.5">تلاش دوباره</button></div>}

    {loading && logs.length === 0 ? <div className="rounded-2xl border border-slate-800 p-12 text-center text-sm text-slate-400"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />در حال دریافت تاریخچه…</div> : <>
      <div className="grid gap-3 md:hidden">
        {logs.map((log) => <article key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
          <div className="flex items-start justify-between gap-3"><div><span className="rounded-lg bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300">{auditActionLabel(log.action)}</span><h3 className="mt-3 text-sm font-bold text-white">{getAuditSummary(log)}</h3></div><button onClick={() => setSelectedLog(log)} aria-label="مشاهده جزئیات" className="shrink-0 rounded-xl border border-slate-700 p-2 text-slate-300"><Eye className="h-4 w-4" /></button></div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500"><span>{log.userName || "کاربر سیستم"}</span><span>{auditEntityLabel(log.entityType)}</span><time>{toJalaliDate(log.createdAt, { showTime: true })}</time></div>
        </article>)}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-800 md:block"><table className="w-full min-w-[780px] text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-3 text-right">زمان</th><th className="p-3 text-right">کاربر</th><th className="p-3 text-right">عملیات</th><th className="p-3 text-right">بخش</th><th className="p-3 text-right">شرح قابل فهم</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-slate-800">{logs.map((log) => <tr key={log.id} className="hover:bg-slate-900/60"><td className="whitespace-nowrap p-3 text-slate-400">{toJalaliDate(log.createdAt, { showTime: true })}</td><td className="p-3">{log.userName || "کاربر سیستم"}</td><td className="p-3 text-cyan-300">{auditActionLabel(log.action)}</td><td className="p-3">{auditEntityLabel(log.entityType)}</td><td className="max-w-lg p-3 text-slate-300">{getAuditSummary(log)}</td><td className="p-3"><button onClick={() => setSelectedLog(log)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300" aria-label="مشاهده جزئیات"><Eye className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
    </>}
    {!loading && logs.length === 0 && !error && <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-sm text-slate-500">رویدادی مطابق فیلترها وجود ندارد.</div>}

    {pagination.totalPages > 1 && <div className="flex flex-wrap justify-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-30">قبلی</button><span className="p-2 text-xs">{page.toLocaleString("fa-IR")} / {pagination.totalPages.toLocaleString("fa-IR")}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-30">بعدی</button></div>}

    {selectedLog && <div role="dialog" aria-modal="true" aria-label="جزئیات رویداد" className="app-modal fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setSelectedLog(null)}><div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 p-4 sm:p-5"><div><span className="text-xs text-cyan-300">{auditEntityLabel(selectedLog.entityType)} · {auditActionLabel(selectedLog.action)}</span><h3 className="mt-1 text-base font-black text-white">{getAuditSummary(selectedLog)}</h3><p className="mt-1 text-[11px] text-slate-500">{selectedLog.userName || "کاربر سیستم"} · {toJalaliDate(selectedLog.createdAt, { showTime: true })}</p></div><button onClick={() => setSelectedLog(null)} aria-label="بستن" className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"><div className="space-y-2">{getAuditDetailRows(selectedLog.details).map((row, index) => <div key={`${row.path}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="text-[11px] text-slate-500">{row.label}</div>{row.before !== undefined || row.after !== undefined ? <div className="mt-2 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-rose-950/25 p-2"><span className="text-[10px] text-rose-300">قبل</span><p className="mt-1 break-words text-xs text-slate-300">{row.before}</p></div><div className="rounded-lg bg-emerald-950/25 p-2"><span className="text-[10px] text-emerald-300">بعد</span><p className="mt-1 break-words text-xs text-white">{row.after}</p></div></div> : <p className="mt-1 break-words text-sm text-white">{row.value}</p>}</div>)}{getAuditDetailRows(selectedLog.details).length === 0 && <p className="py-8 text-center text-sm text-slate-500">جزئیات بیشتری برای این رویداد ثبت نشده است.</p>}</div></div>
      <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-800 bg-slate-950 p-4 sm:flex-row sm:justify-between"><button onClick={() => setSelectedLog(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">بستن</button>{selectedLog.entityId && AUDIT_NAVIGATION[selectedLog.entityType] && onNavigate && <button onClick={() => openEntity(selectedLog)} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white"><ArrowUpLeft className="h-4 w-4" />مشاهده رکورد مرتبط</button>}</footer>
    </div></div>}
  </div>;
}
