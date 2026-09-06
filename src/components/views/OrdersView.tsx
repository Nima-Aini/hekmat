"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FilePlus2, Plus, RefreshCw, ShoppingCart, X } from "lucide-react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatMoney, toJalaliDate } from "@/lib/dateUtils";

export function OrdersView({ selectedProjectId, permissions }: { selectedProjectId?: string | null; permissions?: Set<string> | string[] }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [focusOrderId, setFocusOrderId] = useState("");
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [form, setForm] = useState<any>({ customerId: "", deliveryDate: "", notes: "", items: [{ productId: "", quantity: 1, unitPrice: 0 }] });
  const permissionSet = permissions instanceof Set ? permissions : new Set(permissions || ["*"]);
  const can = (code: string) => permissionSet.has("*") || permissionSet.has(code) || permissionSet.has("orders.manage");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      if (focusOrderId) params.set("id", focusOrderId);
      const data = await fetch(`/api/orders?${params}`).then((response) => response.json());
      if (!data.success) throw new Error(data.error || "خطا در دریافت سفارش‌ها");
      setOrders(data.orders || []); setPagination(data.pagination || { total: 0, totalPages: 1 });
    } catch (cause: any) { setError(cause.message || "خطا در دریافت سفارش‌ها"); }
    finally { setLoading(false); }
  }, [focusOrderId, page, selectedProjectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const navigate = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.type === "order" && detail.id) { setFocusOrderId(detail.id); setPage(1); } };
    window.addEventListener("akma:navigate-item", navigate);
    return () => window.removeEventListener("akma:navigate-item", navigate);
  }, []);
  useEffect(() => {
    Promise.all([
      fetch(`/api/customers?page=1&pageSize=100${selectedProjectId ? `&projectId=${selectedProjectId}` : ""}`).then((r) => r.json()),
      fetch("/api/products?page=1&pageSize=100&status=active").then((r) => r.json()),
    ]).then(([customerData, productData]) => { setCustomers(customerData.customers || []); setProducts(productData.products || []); }).catch(() => undefined);
  }, [selectedProjectId]);

  const updateItem = (index: number, patch: any) => setForm((current: any) => ({ ...current, items: current.items.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item) }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ ...form, projectId: selectedProjectId || null }) });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "ثبت سفارش ناموفق بود.");
      setShowCreate(false); setForm({ customerId: "", deliveryDate: "", notes: "", items: [{ productId: "", quantity: 1, unitPrice: 0 }] }); await load();
    } catch (cause: any) { setError(cause.message || "ثبت سفارش ناموفق بود."); }
    finally { setSaving(false); }
  };
  const convert = async (id: string) => {
    if (!confirm("این سفارش به فاکتور تبدیل شود؟ موجودی و اسناد مالی فقط در این مرحله ثبت می‌شوند.")) return;
    const data = await fetch(`/api/orders/${id}/convert`, { method: "POST" }).then((r) => r.json());
    if (!data.success) return alert(data.error || "تبدیل سفارش ناموفق بود.");
    await load(); window.dispatchEvent(new CustomEvent("akma:navigate-item", { detail: { type: "invoice", id: data.invoice.id } }));
  };
  const cancel = async (id: string) => {
    if (!confirm("این سفارش لغو شود؟ اطلاعات سفارش و تاریخچه آن حذف نخواهد شد.")) return;
    const data = await fetch(`/api/orders/${id}`, { method: "DELETE" }).then((response) => response.json());
    if (!data.success) return alert(data.error || "لغو سفارش انجام نشد.");
    await load();
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-black text-white">سفارشات</h2><p className="text-xs text-slate-400">سفارش تا زمان تبدیل به فاکتور هیچ اثر مالی یا انباری ندارد.</p></div>
      {can("orders.create") && <button onClick={() => setShowCreate(true)} className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-4 w-4" />سفارش جدید</button>}
    </div>
    {focusOrderId && <button onClick={() => setFocusOrderId("")} className="text-xs text-cyan-300">نمایش همه سفارش‌ها</button>}
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</div>}
    <div className="overflow-auto rounded-2xl border border-slate-800 bg-slate-900/50">
      {loading ? <div className="p-12 text-center text-sm text-slate-400"><RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />در حال دریافت سفارش‌ها…</div> :
      <table className="w-full min-w-[850px] text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-3 text-right">شماره</th><th>فروشگاه</th><th>اقلام</th><th>تحویل</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody className="divide-y divide-slate-800">{orders.map((order) => <tr key={order.id}><td className="p-3 font-mono text-cyan-300">{order.orderNumber}</td><td>{order.storeName}</td><td>{order.items?.length || 0}</td><td>{order.deliveryDate ? toJalaliDate(order.deliveryDate) : "بدون تاریخ"}</td><td><span className="rounded-lg bg-slate-800 px-2 py-1">{{ open: "باز", ready: "آماده", converted: "تبدیل‌شده", cancelled: "لغوشده" }[order.status as string] || order.status}</span></td><td className="space-x-2 space-x-reverse">{["open", "ready"].includes(order.status) && can("orders.convert") && <button onClick={() => convert(order.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white">تبدیل به فاکتور</button>}{["open", "ready"].includes(order.status) && can("orders.cancel") && <button onClick={() => cancel(order.id)} className="rounded-lg border border-rose-500/40 px-3 py-1.5 font-bold text-rose-300">لغو</button>}</td></tr>)}</tbody></table>}
      {!loading && orders.length === 0 && <div className="p-10 text-center text-sm text-slate-500">سفارشی در این بازه وجود ندارد.</div>}
    </div>
    {pagination.totalPages > 1 && <div className="flex justify-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40">قبلی</button><span className="p-2 text-xs text-slate-400">صفحه {page.toLocaleString("fa-IR")} از {pagination.totalPages.toLocaleString("fa-IR")}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40">بعدی</button></div>}
    {showCreate && <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/80 p-4"><form onSubmit={submit} className="my-8 w-full max-w-3xl space-y-4 rounded-3xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><ShoppingCart className="h-5 w-5 text-purple-400" />ثبت سفارش بدون اثر حسابداری</h3><button type="button" onClick={() => setShowCreate(false)} aria-label="بستن"><X className="h-5 w-5" /></button></div>
      <select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3"><option value="">انتخاب مشتری / فروشگاه</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.storeName || customer.name}</option>)}</select>
      {form.items.map((item: any, index: number) => <div key={index} className="grid gap-2 rounded-xl border border-slate-800 p-3 sm:grid-cols-[1fr_120px_190px_auto]"><select required value={item.productId} onChange={(e) => { const product = products.find((p) => p.id === e.target.value); updateItem(index, { productId: e.target.value, unitPrice: Number(product?.basePrice || 0) }); }} className="rounded-lg bg-slate-900 p-2"><option value="">انتخاب محصول</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — موجودی {product.stockQuantity}</option>)}</select><input type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} className="rounded-lg bg-slate-900 p-2" /><MoneyInput value={item.unitPrice} onChange={(unitPrice) => updateItem(index, { unitPrice })} unit="تومان" /><button type="button" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_: any, itemIndex: number) => itemIndex !== index) })} className="text-rose-400 disabled:opacity-30"><X className="h-4 w-4" /></button></div>)}
      <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { productId: "", quantity: 1, unitPrice: 0 }] })} className="text-xs text-purple-300">+ افزودن محصول</button>
      <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs text-slate-400">تاریخ تحویل (اختیاری)</label><input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className="w-full rounded-xl bg-slate-900 p-3" /></div><div><label className="mb-1 block text-xs text-slate-400">جمع برآوردی</label><div className="rounded-xl bg-slate-900 p-3 font-bold text-emerald-300">{formatMoney(form.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0))}</div></div></div>
      <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="توضیحات سفارش" className="w-full rounded-xl bg-slate-900 p-3" />
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-700 px-4 py-2">انصراف</button><button disabled={saving} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 font-bold"><FilePlus2 className="h-4 w-4" />{saving ? "در حال ثبت…" : "ثبت سفارش"}</button></div>
    </form></div>}
  </div>;
}
