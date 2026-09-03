"use client";
import React, { useEffect, useState } from "react";
import { Save, Plus, BarChart3, GitCompare, Package, Coins, ListTodo, ReceiptText, WalletCards, Trash2, Calendar, Tag, AlertCircle, Building, CheckCircle2 } from "lucide-react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { toJalaliDate } from "@/lib/dateUtils";

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));

export const ProjectExtrasView: React.FC<{ project: any; tab: string; employees: any[]; projects: any[] }> = ({ project, tab, employees, projects }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [forecast, setForecast] = useState<any>(null);
  const [compareIds, setCompareIds] = useState<string[]>([project.id]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "pricing") {
        const [a, b] = await Promise.all([
          fetch(`/api/projects/${project.id}/pricing`).then((r) => r.json()),
          fetch(`/api/products`).then((r) => r.json()),
        ]);
        if (!a.success) throw Error(a.error);
        setRows(a.prices || []);
        setProducts(b.products || []);
      } else if (tab === "commission") {
        const a = await fetch(`/api/projects/${project.id}/commission-rules`).then((r) => r.json());
        if (!a.success) throw Error(a.error);
        setRows(a.rules || []);
      } else if (tab === "tasks") {
        const a = await fetch(`/api/projects/${project.id}/tasks`).then((r) => r.json());
        if (!a.success) throw Error(a.error);
        setRows(a.tasks || []);
      } else if (tab === "consignments") {
        const a = await fetch(`/api/projects/${project.id}/consignments`).then((r) => r.json());
        if (!a.success) throw Error(a.error);
        setRows(a.consignments || []);
      } else if (tab === "expenses") {
        const [a, b] = await Promise.all([
          fetch(`/api/projects/${project.id}/expenses`).then((r) => r.json()),
          fetch("/api/accounts").then((r) => r.json()),
        ]);
        if (!a.success) throw Error(a.error);
        setRows(a.expenses || []);
        if (b.success) setAccounts(b.accounts || []);
      } else if (tab === "reports") {
        const a = await fetch(`/api/projects/${project.id}/analytics?mode=report`).then((r) => r.json());
        if (!a.success) throw Error(a.error);
        setRows([a.report]);
        const f = await fetch(`/api/projects/analytics?projectId=${project.id}&mode=forecast&months=6`).then((r) => r.json());
        if (f.success) setForecast(f.forecast);
      } else if (tab === "compare") {
        setRows(projects.filter((p) => compareIds.includes(p.id)));
      }
    } catch (e: any) {
      setError(e.message || "خطا");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab, project.id]);

  const save = async () => {
    setSubmitting(true);
    try {
      let url = "",
        body: any = {};
      if (tab === "pricing") {
        url = `/api/projects/${project.id}/pricing`;
        body = {
          productId: form.productId,
          customPrice: Number(form.customPrice),
          overrideCommissionRate: form.overrideCommissionRate === "" ? null : Number(form.overrideCommissionRate),
        };
      } else if (tab === "commission") {
        url = `/api/projects/${project.id}/commission-rules`;
        body = {
          name: form.name,
          ruleType: form.ruleType || "percentage",
          rateValue: Number(form.rateValue),
          productId: form.productId || null,
          employeeId: form.employeeId || null,
          effectiveStartDate: form.effectiveStartDate || new Date().toISOString(),
        };
      } else if (tab === "tasks") {
        url = `/api/projects/${project.id}/tasks`;
        body = {
          title: form.title,
          description: form.description,
          assignedEmployeeId: form.assignedEmployeeId || null,
          dueDate: form.dueDate || null,
          priority: form.priority || "medium",
        };
      } else if (tab === "expenses") {
        if (!form.title || !form.amount || Number(form.amount) <= 0) {
          alert("لطفاً عنوان و مبلغ هزینه را وارد فرمایید.");
          setSubmitting(false);
          return;
        }
        url = `/api/projects/${project.id}/expenses`;
        body = {
          title: form.title,
          category: form.category || "عمومی",
          amount: Number(form.amount),
          accountId: form.accountId || null,
          description: form.description || null,
          expenseDate: form.expenseDate || new Date().toISOString(),
        };
      }

      if (!url) return;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((x) => x.json());

      if (!r.success) {
        alert(r.error || "خطا در ثبت اطلاعات");
        return;
      }

      setForm({});
      if (tab === "expenses") {
        window.dispatchEvent(new CustomEvent("akma:expenses-updated"));
        window.dispatchEvent(new CustomEvent("akma:accounts-updated"));
      }
      load();
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm("آیا از حذف این هزینه اطمینان دارید؟ در صورت کسر از حساب، مبلغ به موجودی حساب برگشت داده می‌شود.")) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/expenses?expenseId=${expenseId}`, {
        method: "DELETE",
      }).then((r) => r.json());
      if (res.success) {
        window.dispatchEvent(new CustomEvent("akma:expenses-updated"));
        window.dispatchEvent(new CustomEvent("akma:accounts-updated"));
        load();
      } else {
        alert(res.error || "خطا در حذف هزینه");
      }
    } catch (err: any) {
      alert(err.message || "خطا در سیستم");
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-800 p-8 text-center text-slate-500">در حال بارگذاری…</div>;
  if (error)
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-6 text-rose-300 text-sm">
        {error}
        <button onClick={load} className="block mt-3 rounded-lg bg-slate-800 px-3 py-2">
          تلاش دوباره
        </button>
      </div>
    );

  if (tab === "compare")
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <GitCompare className="h-4 w-4" />
            مقایسه پروژه‌ها
          </div>
          <div className="flex flex-wrap gap-2">
            {projects.map((p: any) => (
              <label key={p.id} className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={compareIds.includes(p.id)}
                  onChange={(e) => setCompareIds((v) => (e.target.checked ? [...v, p.id] : v.filter((id) => id !== p.id)))}
                  className="ml-2"
                />
                {p.name}
              </label>
            ))}
          </div>
          <button onClick={load} className="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold">
            مقایسه
          </button>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((p: any) => (
            <div key={p.id} className="rounded-2xl border border-slate-800 p-4">
              <b>{p.project?.name || p.name}</b>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-400">
                <span>فروش: {money(Number(p.sales || 0))}</span>
                <span>سود: {money(Number(p.grossProfit || 0))}</span>
                <span>پورسانت: {money(Number(p.commission || 0))}</span>
                <span>وصولی: {money(Number(p.collected || 0))}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      {tab === "pricing" && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={form.productId || ""}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            >
              <option value="">محصول</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <MoneyInput
              value={Number(form.customPrice) || 0}
              onChange={(val) => setForm({ ...form, customPrice: val })}
              placeholder="قیمت پروژه"
              className="w-36 text-xs py-1.5"
              unit="تومان"
            />
            <input
              type="number"
              value={form.overrideCommissionRate ?? ""}
              onChange={(e) => setForm({ ...form, overrideCommissionRate: e.target.value })}
              placeholder="پورسانت Override %"
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            />
            <button onClick={save} disabled={submitting} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold flex gap-2">
              <Save className="h-4 w-4" />
              ذخیره قیمت
            </button>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((r: any) => (
              <div key={r.price.id} className="rounded-xl border border-slate-800 p-4 text-xs">
                <b>{r.productName}</b>
                <p className="text-slate-400 mt-2">قیمت پروژه: {money(Number(r.price.customPrice || 0))}</p>
                <p className="text-slate-500">Override پورسانت: {r.price.overrideCommissionRate ?? "-"}%</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "commission" && (
        <>
          <div className="grid md:grid-cols-5 gap-2">
            <input
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="نام Rule"
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            />
            <select
              value={form.ruleType || "percentage"}
              onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            >
              <option value="percentage">درصدی</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="receipt_percentage">درصد وصولی</option>
            </select>
            <input
              type="number"
              value={form.rateValue || ""}
              onChange={(e) => setForm({ ...form, rateValue: e.target.value })}
              placeholder="مقدار"
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            />
            <select
              value={form.employeeId || ""}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            >
              <option value="">همه همکاران</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button onClick={save} disabled={submitting} className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold flex gap-2 justify-center">
              <Plus className="h-4 w-4" />
              Rule جدید
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-slate-800 p-4 flex flex-wrap justify-between gap-2 text-xs">
                <div>
                  <b>{r.name}</b>
                  <span className="text-slate-500 mr-3">{r.ruleType}</span>
                </div>
                <div>
                  {Number(r.rateValue || 0).toLocaleString("fa-IR")} {r.ruleType === "percentage" || r.ruleType === "receipt_percentage" ? "%" : "تومان"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "tasks" && (
        <>
          <div className="grid md:grid-cols-5 gap-2">
            <input
              value={form.title || ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عنوان Task"
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            />
            <select
              value={form.assignedEmployeeId || ""}
              onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            >
              <option value="">همکار</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.dueDate || ""}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            />
            <select
              value={form.priority || "medium"}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
            >
              <option value="low">کم</option>
              <option value="medium">متوسط</option>
              <option value="high">زیاد</option>
            </select>
            <button onClick={save} disabled={submitting} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold">
              <Plus className="inline h-4 w-4" /> Task
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-slate-800 p-4">
                <div className="flex justify-between">
                  <b className="text-sm">{r.title}</b>
                  <span className="text-xs text-slate-500">{r.status}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {r.priority} · {r.dueDate ? toJalaliDate(r.dueDate) : "بدون سررسید"}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "consignments" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["کل", rows.length],
              ["باز", rows.filter((r: any) => ["delivered", "partially_sold"].includes(r.consignment?.status)).length],
              ["تسویه", rows.filter((r: any) => ["closed", "fully_sold"].includes(r.consignment?.status)).length],
              ["برگشتی", rows.filter((r: any) => r.consignment?.status === "returned").length],
            ].map(([l, v]: any) => (
              <div key={l} className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-center">
                <span className="text-xs text-slate-500">{l}</span>
                <b className="block text-xl mt-1">{v}</b>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={r.consignment.id} className="rounded-xl border border-slate-800 p-4 text-xs flex justify-between">
                <div>
                  <b>{r.consignment.consignmentNumber}</b>
                  <p className="text-slate-500 mt-1">
                    {r.customerName} · {r.employeeName || "-"}
                  </p>
                </div>
                <div className="text-left">
                  <div>{r.consignment.status}</div>
                  <div>{money(Number(r.consignment.totalConsignedValue || 0))}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* REDESIGNED EXPENSES TAB WITH DIRECT ACCOUNT SELECT AND SYNC */}
      {tab === "expenses" && (
        <div className="space-y-5">
          {/* Expense Entry Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <WalletCards className="h-4 w-4 text-amber-400" />
                ثبت هزینه جدید پروژه و کسر خودکار از حساب
              </div>
              <span className="text-[11px] text-slate-400">
                پروژه: <span className="text-white font-semibold">{project.name}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">عنوان هزینه *</label>
                <input
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: هزینه بسته‌بندی یا حمل سفارش"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">مبلغ هزینه *</label>
                <MoneyInput
                  value={Number(form.amount) || 0}
                  onChange={(val) => setForm({ ...form, amount: val })}
                  placeholder="مبلغ به تومان"
                  className="text-xs py-2"
                  unit="تومان"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">حساب پرداخت‌کننده (کسر خودکار موجودی)</label>
                <select
                  value={form.accountId || ""}
                  onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">بدون انتخاب حساب (هزینه تعهدی/نقدی خارجی)</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({money(Number(acc.balance || 0))} تومان)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">دسته‌بندی هزینه</label>
                <input
                  list="expense-categories"
                  value={form.category || ""}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="انتخاب یا تایپ دسته‌بندی"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
                <datalist id="expense-categories">
                  <option value="تدارکات و مواد اولیه" />
                  <option value="حمل و نقل و لجستیک" />
                  <option value="دستمزد و پیمانکاری" />
                  <option value="اداری و پذیرایی" />
                  <option value="تبلیغات و بازاریابی" />
                  <option value="بسته‌بندی و انبارداری" />
                  <option value="عمومی و متفرقه" />
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">تاریخ هزینه</label>
                <input
                  type="date"
                  value={form.expenseDate || new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">توضیحات و بابت</label>
                <input
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="توضیحات اختیاری، شماره فاکتور خرید و ..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={save}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {submitting ? "در حال ثبت و کسر از حساب..." : "ثبت هزینه و همگام‌سازی با حساب"}
              </button>
            </div>
          </div>

          {/* Expenses Stats & List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ReceiptText className="h-4 w-4 text-slate-400" />
                لیست هزینه‌های ثبت شده برای پروژه ({rows.length} فقره)
              </span>
              <div className="text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-xl">
                مجموع هزینه‌های پروژه: {money(rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))} تومان
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-500">
                هنوز هزینه‌ای برای این پروژه ثبت نگردیده است.
              </div>
            ) : (
              <div className="grid gap-2">
                {rows.map((r: any) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <b className="text-white text-sm">{r.title}</b>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{r.category || "عمومی"}</span>
                        {r.expenseNumber && <span className="font-mono text-[10px] text-slate-500">{r.expenseNumber}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>تاریخ: {toJalaliDate(r.expenseDate || r.createdAt)}</span>
                        {r.accountName ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <Building className="h-3 w-3 inline" /> کسر از: {r.accountName}
                          </span>
                        ) : (
                          <span className="text-slate-500">بدون حساب مالی</span>
                        )}
                        {r.description && <span className="text-slate-500">· {r.description}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <b className="text-sm font-mono text-amber-400">{money(Number(r.amount || 0))} تومان</b>
                      <button
                        onClick={() => deleteExpense(r.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                        title="حذف هزینه و استرداد موجودی به حساب"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "reports" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["فروش", rows[0]?.sales],
              ["سود ناخالص", rows[0]?.grossProfit],
              ["پورسانت", rows[0]?.commission],
              ["وصولی", rows[0]?.collected],
              ["هزینه", rows[0]?.expense],
              ["مطالبات", rows[0]?.receivable],
              ["مشتری پرریسک", rows[0]?.riskyCustomers],
              ["سود خالص", rows[0]?.netProfit],
            ].map(([l, v]: any) => (
              <div key={l} className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                <div className="text-xs text-slate-500">{l}</div>
                <b className="text-lg mt-1 block">{typeof v === "number" ? money(v) : "—"}</b>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-800 p-4">
            <h4 className="font-bold flex gap-2">
              <BarChart3 className="h-4 w-4" /> Forecast
            </h4>
            <p className="text-xs text-slate-400 mt-2">۶ ماه آینده بر اساس run-rate واقعی فعلی.</p>
            <div className="grid md:grid-cols-3 gap-3 mt-4 text-xs">
              <span>فروش ماهانه: {money(Number(forecast?.monthlySalesRunRate || 0))}</span>
              <span>فروش پیش‌بینی: {money(Number(forecast?.projectedSales || 0))}</span>
              <span>سود پیش‌بینی: {money(Number(forecast?.projectedGrossProfit || 0))}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
