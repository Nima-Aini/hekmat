"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toJalaliDate } from "@/lib/dateUtils";

export function AuditLogsView({ selectedProjectId }: { selectedProjectId?: string | null }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: "", action: "", entityType: "", startDate: "", endDate: "" });
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    const data = await fetch(`/api/audit-logs?${params}`).then((r) => r.json()).catch(() => ({ success: false }));
    if (data.success) { setLogs(data.logs || []); setPagination(data.pagination); }
    setLoading(false);
  }, [filters, page, selectedProjectId]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  const setFilter = (key: string, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  return <div className="space-y-5"><div><h2 className="flex items-center gap-2 text-xl font-black"><ShieldCheck className="h-6 w-6 text-cyan-400" />لاگ فعالیت‌ها</h2><p className="text-xs text-slate-400">لاگ‌ها immutable هستند؛ اصلاح یک عملیات با رویداد جدید ثبت می‌شود.</p></div>
    <div className="grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:grid-cols-2 xl:grid-cols-5"><div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" /><input value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="جستجو…" className="w-full rounded-xl bg-slate-950 py-2.5 pr-9 text-xs" /></div><input value={filters.action} onChange={(e) => setFilter("action", e.target.value)} placeholder="Action" className="rounded-xl bg-slate-950 p-2.5 text-xs" /><input value={filters.entityType} onChange={(e) => setFilter("entityType", e.target.value)} placeholder="نوع موجودیت" className="rounded-xl bg-slate-950 p-2.5 text-xs" /><input type="date" value={filters.startDate} onChange={(e) => setFilter("startDate", e.target.value)} className="rounded-xl bg-slate-950 p-2.5 text-xs" /><input type="date" value={filters.endDate} onChange={(e) => setFilter("endDate", e.target.value)} className="rounded-xl bg-slate-950 p-2.5 text-xs" /></div>
    <div className="overflow-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[900px] text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-3 text-right">زمان</th><th>کاربر</th><th>عملیات</th><th>موجودیت</th><th className="text-right">خلاصه</th></tr></thead><tbody className="divide-y divide-slate-800">{logs.map((log) => <tr key={log.id}><td className="p-3">{toJalaliDate(log.createdAt, { showTime: true })}</td><td>{log.userName}</td><td className="font-mono text-cyan-300">{log.action}</td><td>{log.entityType}<div className="font-mono text-[10px] text-slate-600">{log.entityId}</div></td><td className="max-w-md truncate text-slate-400">{JSON.stringify(log.details || {})}</td></tr>)}</tbody></table>{loading && <div className="p-10 text-center text-slate-400"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />در حال دریافت لاگ…</div>}{!loading && logs.length === 0 && <div className="p-10 text-center text-slate-500">لاگی مطابق فیلترها وجود ندارد.</div>}</div>
    <div className="flex justify-center gap-2"><button disabled={page <= 1} onClick={() => setPage((v) => v - 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-30">قبلی</button><span className="p-2 text-xs">{page.toLocaleString("fa-IR")} / {pagination.totalPages.toLocaleString("fa-IR")}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((v) => v + 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-30">بعدی</button></div>
  </div>;
}
