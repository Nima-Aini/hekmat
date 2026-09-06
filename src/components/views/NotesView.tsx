"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Plus, RefreshCw, X } from "lucide-react";
import { toJalaliDate } from "@/lib/dateUtils";

export function NotesView({ selectedProjectId, permissions }: { selectedProjectId?: string | null; permissions?: Set<string> | string[] }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ description: "", dueDate: "", priority: "medium" });
  const permissionSet = permissions instanceof Set ? permissions : new Set(permissions || ["*"]);
  const can = (code: string) => permissionSet.has("*") || permissionSet.has(code);
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", pageSize: "100" });
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    try { const data = await fetch(`/api/notes?${params}`).then((r) => r.json()); if (!data.success) throw new Error(data.error); setNotes(data.notes || []); setError(""); }
    catch (cause: any) { setError(cause.message || "دریافت یادداشت‌ها ناموفق بود."); }
    finally { setLoading(false); }
  }, [selectedProjectId]);
  useEffect(() => { load(); }, [load]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const data = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, projectId: selectedProjectId || null }) }).then((r) => r.json());
    if (!data.success) return setError(data.error || "ثبت یادداشت ناموفق بود.");
    setShowCreate(false); setForm({ description: "", dueDate: "", priority: "medium" }); await load();
  };
  const complete = async (id: string) => {
    const data = await fetch(`/api/notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) }).then((r) => r.json());
    if (!data.success) return setError(data.error || "تکمیل یادداشت ناموفق بود."); await load();
  };
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">یادداشت‌ها و یادآورها</h2><p className="text-xs text-slate-400">یادآوری خودکار از دو روز پیش از موعد</p></div>{can("notes.create") && <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold"><Plus className="h-4 w-4" />یادداشت جدید</button>}</div>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</div>}
    {loading ? <div className="rounded-2xl border border-slate-800 p-12 text-center text-slate-400"><RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />در حال بارگذاری…</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{notes.map((note) => <article key={note.id} className={`rounded-2xl border p-4 ${note.status === "pending" ? "border-amber-500/30 bg-amber-950/20" : "border-slate-800 bg-slate-900/50 opacity-70"}`}><div className="flex items-start justify-between gap-2"><BellRing className="h-4 w-4 text-amber-400" /><span className="text-[10px] text-slate-500">{note.dueDate ? toJalaliDate(note.dueDate) : "بدون موعد"}</span></div><h3 className="mt-3 text-sm font-bold">{note.title}</h3><p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-slate-400">{note.description}</p>{note.status === "pending" && can("notes.complete") && <button onClick={() => complete(note.id)} className="mt-3 flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs"><Check className="h-3.5 w-3.5" />انجام شد</button>}</article>)}</div>}
    {!loading && notes.length === 0 && <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-sm text-slate-500">یادداشتی ثبت نشده است.</div>}
    {showCreate && <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"><form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-800 bg-slate-950 p-5"><div className="flex justify-between"><h3 className="font-bold">یادداشت جدید</h3><button type="button" onClick={() => setShowCreate(false)}><X className="h-5 w-5" /></button></div><textarea required rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="متن یادداشت…" className="w-full rounded-xl bg-slate-900 p-3" /><label className="block text-xs text-slate-400">تاریخ یادآوری (اختیاری)<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1 w-full rounded-xl bg-slate-900 p-3 text-white" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-700 px-4 py-2">انصراف</button><button className="rounded-xl bg-purple-600 px-4 py-2 font-bold">ذخیره</button></div></form></div>}
  </div>;
}
