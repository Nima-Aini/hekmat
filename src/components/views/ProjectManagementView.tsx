"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  Clock3,
  DollarSign,
  FolderKanban,
  MapPin,
  Plus,
  Save,
  Settings2,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  Package as PackageIcon,
  GitCompare,
  CheckCircle2,
  Folder
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { ProjectExtrasView } from "@/components/views/ProjectExtrasView";
import { toJalaliDate, formatMoney, formatNumber } from "@/lib/dateUtils";

const statusLabel = (s: string) =>
  ({ active: "فعال", paused: "متوقف موقت", completed: "پایان‌یافته", archived: "آرشیو شده" }[s] || s);

export const ProjectManagementView: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [tab, setTab] = useState("overview");
  const [dashboard, setDashboard] = useState<any>();
  const [analytics, setAnalytics] = useState<any>();
  const [customers, setCustomers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState<any>({
    code: "",
    name: "",
    label: "",
    description: "",
    color: "#3b82f6",
    status: "active",
    managerEmployeeId: "",
    independentSalesAllowed: false,
    targetMonthlySales: 0,
    targetYearlySales: 0,
    targetCustomerCount: 0,
    targetProfit: 0,
    targetCollection: 0,
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [p, e] = await Promise.all([
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/employees").then((r) => r.json()),
      ]);
      if (!p.success) throw Error(p.error);
      setProjects(p.projects || []);
      if (e.success) setEmployees(e.employees || []);
    } catch (e: any) {
      setError(e.message || "خطا در دریافت پروژه‌ها");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handleNavigation = async (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; id?: string }>).detail;
      if (detail?.type !== "project" || !detail.id) return;
      const response = await fetch(`/api/projects/${detail.id}`).then((result) => result.json());
      if (response.success && response.project) openProject(response.project);
    };
    window.addEventListener("akma:navigate-item", handleNavigation);
    return () => window.removeEventListener("akma:navigate-item", handleNavigation);
  }, []);

  const openProject = async (p: any) => {
    setSelected(p);
    setTab("overview");
    try {
      const [d, a, c, m, act] = await Promise.all([
        fetch(`/api/projects/${p.id}/dashboard`).then((r) => r.json()),
        fetch(`/api/projects/${p.id}/analytics`).then((r) => r.json()),
        fetch(`/api/projects/${p.id}/customers`).then((r) => r.json()),
        fetch(`/api/projects/${p.id}/employees`).then((r) => r.json()),
        fetch(`/api/projects/${p.id}/activity`).then((r) => r.json()),
      ]);
      if (d.success) setDashboard(d.dashboard);
      if (a.success) setAnalytics(a.analytics);
      if (c.success) setCustomers(c.customers || []);
      if (m.success) setMembers(m.members || []);
      if (act.success) setActivity(act.activity || []);
    } catch (err) {
      console.error("Error opening project details:", err);
    }
  };

  const openCreate = () => {
    setEditingProject(null);
    setForm({
      code: `PRJ-${Date.now().toString().slice(-5)}`,
      name: "",
      label: "",
      description: "",
      color: "#3b82f6",
      status: "active",
      managerEmployeeId: "",
      independentSalesAllowed: false,
      targetMonthlySales: 0,
      targetYearlySales: 0,
      targetCustomerCount: 0,
      targetProfit: 0,
      targetCollection: 0,
    });
    setShow(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("لطفاً نام پروژه را وارد نمایید.");
      return;
    }
    const url = editingProject ? `/api/projects/${editingProject.id}` : "/api/projects";
    const method = editingProject ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          code: form.code.trim() || `PRJ-${Date.now().toString().slice(-5)}`,
          managerEmployeeId: form.managerEmployeeId && form.managerEmployeeId.trim() !== "" ? form.managerEmployeeId : null,
        }),
      });

      let r: any;
      try {
        r = await response.json();
      } catch {
        throw new Error("پاسخ نامعتبر از سرور دریافت شد.");
      }

      if (!r.success) {
        alert(r.error || "خطا در ذخیره اطلاعات پروژه");
        return;
      }

      setShow(false);
      setEditingProject(null);
      await load();
      if (editingProject && selected) {
        setSelected({ ...selected, ...form });
      }

      // Broadcast project update so top-bar selector and other views sync immediately!
      window.dispatchEvent(new CustomEvent("akma:projects-updated"));
      alert(editingProject ? "اطلاعات پروژه با موفقیت ویرایش شد." : (r.message || `پروژه «${form.name}» با موفقیت ایجاد شد.`));
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط با سرور هنگام ذخیره پروژه");
    }
  };

  const archive = async () => {
    if (!selected || !confirm("پروژه آرشیو شود؟ تمام اطلاعات تاریخی برای گزارش‌ها حفظ می‌شود.")) return;
    const r = await fetch(`/api/projects/${selected.id}`, { method: "DELETE" }).then((x) => x.json());
    if (!r.success) return alert(r.error);
    setSelected(null);
    await load();
    window.dispatchEvent(new CustomEvent("akma:projects-updated"));
  };

  const openEditProject = (p: any) => {
    setEditingProject(p);
    setForm({
      code: p.code || "",
      name: p.name || "",
      label: p.label || "",
      targetMonthlySales: Number(p.targetMonthlySales || 0),
      targetYearlySales: Number(p.targetYearlySales || 0),
      targetCustomerCount: Number(p.targetCustomerCount || 0),
      targetProfit: Number(p.targetProfit || 0),
      targetCollection: Number(p.targetCollection || 0),
      managerEmployeeId: p.managerEmployeeId || "",
      color: p.color || "#3b82f6",
      description: p.description || "",
      independentSalesAllowed: !!p.independentSalesAllowed,
    });
    setShow(true);
  };

  const stats = useMemo(
    () => ({
      active: projects.filter((p) => p.status === "active").length,
      archived: projects.filter((p) => p.status === "archived").length,
    }),
    [projects]
  );

  if (loading)
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
        در حال بارگذاری پروژه‌ها…
      </div>
    );
  if (error)
    return (
      <div className="rounded-3xl border border-rose-500/20 bg-rose-950/20 p-8 text-center text-rose-300">
        {error}
        <button className="block mx-auto mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs" onClick={load}>
          تلاش مجدد
        </button>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-cyan-400" />
            مدیریت پروژه‌ها و Scope عملیاتی
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تفکیک حساب‌ها، مشتریان اختصاصی، تیم‌های فروش، پورسانت‌ها، اهداف و P&L مستقل هر پروژه
          </p>
        </div>
        <button onClick={openCreate} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-white hover:bg-cyan-500 transition shadow-lg shadow-cyan-600/30">
          <Plus className="h-4 w-4" />
          + تعریف پروژه جدید
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">پروژه‌های فعال</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">پروژه‌های آرشیو شده</p>
          <p className="text-2xl font-black text-slate-400 mt-1">{stats.archived}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">مجموع پروژه‌ها</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">{projects.length}</p>
        </div>
      </div>

      {/* Project Cards Grid */}
      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
          <Folder className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-sm">هنوز پروژه‌ای در سیستم ثبت نشده است.</p>
          <button onClick={openCreate} className="mt-3 inline-flex items-center gap-1 text-xs bg-cyan-600 px-4 py-2 rounded-xl text-white hover:bg-cyan-500">
            <Plus className="h-4 w-4" />
            ایجاد اولین پروژه
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => openProject(p)}
              className="text-right rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-cyan-500/50 hover:bg-slate-900 transition group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-[10px] text-slate-500 font-bold">{p.code}</span>
                  <h3 className="font-bold text-white text-base mt-1 group-hover:text-cyan-300 transition">{p.name}</h3>
                </div>
                <span
                  className="h-9 w-9 rounded-xl shrink-0"
                  style={{ background: p.color || "#3b82f6", boxShadow: `0 0 20px ${p.color || "#3b82f6"}66` }}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <NeonBadge
                  variant={
                    p.status === "active"
                      ? "green"
                      : p.status === "paused"
                      ? "yellow"
                      : p.status === "archived"
                      ? "gray"
                      : "blue"
                  }
                >
                  {statusLabel(p.status)}
                </NeonBadge>
                {p.label && <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">{p.label}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-400 border-t border-slate-800 pt-3">
                <span>هدف ماه: <b className="text-slate-200">{formatMoney(p.targetMonthlySales)}</b></span>
                <span>هدف سال: <b className="text-slate-200">{formatMoney(p.targetYearlySales)}</b></span>
                <span>تعداد مشتری: <b className="text-slate-200">{formatNumber(p.targetCustomerCount)}</b></span>
                <span>فروش مستقل: <b className="text-cyan-300">{p.independentSalesAllowed ? "مجاز" : "ممنوع"}</b></span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Project Details Modal / Workspace */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto"
        >
          <div className="max-w-6xl mx-auto rounded-3xl bg-slate-950 border border-slate-800 p-5 md:p-7 space-y-5 my-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex gap-3 items-center">
                <span
                  className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                  style={{ background: selected.color || "#3b82f6", boxShadow: `0 0 24px ${selected.color || "#3b82f6"}66` }}
                >
                  <FolderKanban className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h3 className="text-xl font-black text-white">{selected.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    کد: {selected.code} · وضعیت: {statusLabel(selected.status)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-xs"
              >
                <X className="h-5 w-5" />
                <span>بستن</span>
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-thin">
              {[
                ["overview", "نمای کلی و داشبورد", BarChart3],
                ["customers", "مشتریان پروژه", Users],
                ["employees", "همکاران پروژه", Users],
                ["pricing", "لیست قیمت‌ها", DollarSign],
                ["commission", "قوانین پورسانت", Wallet],
                ["reports", "گزارش مالی", BarChart3],
                ["tasks", "وظایف و پیگیری‌ها", Clock3],
                ["consignments", "کالاهای امانی", PackageIcon],
                ["expenses", "هزینه‌های پروژه", Wallet],
                ["compare", "تحلیل و مقایسه", GitCompare],
                ["targets", "اهداف فروش", Target],
                ["activity", "لاگ و تاریخچه", Clock3],
                ["settings", "تنظیمات و ویرایش", Settings2],
              ].map(([id, label, I]: any) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-3 py-2 rounded-xl text-xs whitespace-nowrap flex items-center gap-2 transition ${
                    tab === id ? "bg-cyan-600 text-white font-bold shadow-lg shadow-cyan-600/30" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <I className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="space-y-5">
                {dashboard && (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[
                      ["کل فروش", dashboard.sales, true],
                      ["سود ناخالص", dashboard.grossProfit, true],
                      ["سود خالص", dashboard.netProfit, true],
                      ["پورسانت‌ها", dashboard.commission, true],
                      ["وصولی نقد", dashboard.collected, true],
                      ["تعداد فاکتورها", dashboard.invoices, false],
                    ].map(([l, v, isCurrency]: any) => (
                      <div key={l} className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5">
                        <p className="text-[11px] text-slate-400 font-medium">{l}</p>
                        <b className="text-white text-sm mt-1 block">
                          {isCurrency ? formatMoney(v) : formatNumber(v)}
                        </b>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <h4 className="font-bold text-white text-sm mb-4">روند فروش ماهانه</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics?.monthlySales || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip />
                          <Line type="monotone" dataKey="sales" stroke="#22d3ee" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <h4 className="font-bold text-white text-sm mb-4">فروش به تفکیک محصول</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics?.products || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip />
                          <Bar dataKey="sales" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "customers" && (
              <div className="space-y-3">
                <div className="responsive-table overflow-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 bg-slate-900 border-b border-slate-800">
                        <th className="p-3 text-right">نام مشتری / فروشگاه</th>
                        <th className="p-3 text-center">شماره تماس</th>
                        <th className="p-3 text-center">همکار مسئول</th>
                        <th className="p-3 text-center">شاخص سلامت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-900/50">
                          <td className="p-3 font-bold text-white">{c.storeName || c.name}</td>
                          <td className="p-3 text-center text-slate-300 font-mono">{c.mobile}</td>
                          <td className="p-3 text-center text-slate-400">{c.employeeName || "—"}</td>
                          <td className="p-3 text-center">
                            <NeonBadge variant={c.healthStatus === "green" ? "green" : c.healthStatus === "yellow" ? "yellow" : "red"}>
                              سلامت {c.healthScore || 100}
                            </NeonBadge>
                          </td>
                        </tr>
                      ))}
                      {customers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-500">
                            مشتری اختصاصی برای این پروژه ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "employees" && (
              <div className="grid md:grid-cols-2 gap-3">
                {members.map((m: any) => (
                  <div key={m.assignment.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <b className="text-white text-sm">{m.employee.name}</b>
                        <p className="text-xs text-slate-400 mt-0.5">نقش در پروژه: {m.assignment.role}</p>
                      </div>
                      <NeonBadge variant={m.assignment.status === "active" ? "green" : "gray"}>
                        {m.assignment.status === "active" ? "فعال" : "غیرفعال"}
                      </NeonBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                      <span>نرخ پورسانت: <b className="text-cyan-300">{m.assignment.commissionRate ?? "-"}%</b></span>
                      <span>حقوق پروژه: <b className="text-emerald-300">{formatMoney(m.assignment.projectSalary)}</b></span>
                    </div>
                  </div>
                ))}
                {members.length === 0 && <div className="p-8 text-center text-slate-500 col-span-2">همکاری برای این پروژه تعیین نشده است.</div>}
              </div>
            )}

            {tab === "targets" && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <h4 className="font-bold text-white text-sm mb-4">اهداف و پیشرفت پروژه</h4>
                  <div className="space-y-4 text-xs">
                    {[
                      ["فروش ماهانه (تومان)", Number(selected.targetMonthlySales || 0), dashboard?.sales || 0, true],
                      ["فروش سالانه (تومان)", Number(selected.targetYearlySales || 0), dashboard?.sales || 0, true],
                      ["تعداد مشتری هدف", Number(selected.targetCustomerCount || 0), dashboard?.customers || 0, false],
                      ["سود هدف (تومان)", Number(selected.targetProfit || 0), dashboard?.grossProfit || 0, true],
                    ].map(([l, t, a, isCurr]: any) => (
                      <div key={l} className="space-y-1.5">
                        <div className="flex justify-between text-slate-300">
                          <span>{l}</span>
                          <span className="font-bold">
                            {isCurr ? `${formatMoney(a)} / ${formatMoney(t)}` : `${formatNumber(a)} / ${formatNumber(t)}`}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(100, t ? (a / t) * 100 : 0)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "activity" && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activity.map((a: any) => (
                  <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex justify-between items-center">
                    <div>
                      <b className="text-xs text-white">{a.action}</b>
                      <p className="text-[11px] text-slate-400 mt-0.5">{a.details?.reason || a.details?.event || a.entityType}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{toJalaliDate(a.createdAt, { showTime: true })}</span>
                  </div>
                ))}
                {activity.length === 0 && <div className="text-slate-500 text-sm p-6 text-center">لاگی ثبت نشده است.</div>}
              </div>
            )}

            {["pricing", "commission", "reports", "tasks", "consignments", "expenses", "compare"].includes(tab) && (
              <ProjectExtrasView project={selected} tab={tab} employees={employees} projects={projects} />
            )}

            {tab === "settings" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => openEditProject(selected)} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500">
                    ویرایش اطلاعات کامل پروژه
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 text-xs">
                    <h4 className="font-bold text-white text-sm">مشخصات اصلی</h4>
                    <p className="text-slate-400">کد: <span className="text-white font-mono">{selected.code}</span></p>
                    <p className="text-slate-400">نام: <span className="text-white font-bold">{selected.name}</span></p>
                    <p className="text-slate-400">مدیر مسئول: <span className="text-cyan-300">{employees.find((e) => e.id === selected.managerEmployeeId)?.name || "تعیین نشده"}</span></p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 text-xs">
                    <h4 className="font-bold text-white text-sm">مجوزها و دسترسی</h4>
                    <p className="text-slate-400">فروش مستقل: <span className="text-white">{selected.independentSalesAllowed ? "فعال" : "غیرفعال"}</span></p>
                    <p className="text-slate-400">تمام تغییرات در مرکز بازرسی سیستم ثبت می‌شوند.</p>
                  </div>
                </div>
                <div className="pt-2">
                  <button onClick={archive} className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-2.5 text-xs text-rose-300 flex items-center gap-2 hover:bg-rose-900/30 transition">
                    <Archive className="h-4 w-4" />
                    آرشیو امن پروژه
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button onClick={() => setSelected(null)} className="rounded-xl border border-slate-700 px-5 py-2 text-xs text-slate-300 hover:text-white">
                بستن پنجره پروژه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {show && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            onSubmit={save}
            className="w-full max-w-3xl rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-cyan-400" />
                {editingProject ? `ویرایش پروژه (${editingProject.name})` : "تعریف پروژه و اسکوپ جدید"}
              </h3>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-xs"
              >
                <X className="h-4 w-4" />
                <span>بستن</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  کد اختصاصی پروژه <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="مثال: PRJ-101"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام کامل پروژه <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="مثال: خط تولید عطر و بهداشتی آکما"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">برچسب کوتاه (Label):</label>
                <input
                  placeholder="مثال: تولیدی / بازرگانی"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">مدیر مسئول پروژه:</label>
                <select
                  value={form.managerEmployeeId}
                  onChange={(e) => setForm({ ...form, managerEmployeeId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white"
                >
                  <option value="">-- بدون مدیر / عمومی --</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role || "همکار"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">هدف فروش ماهانه (تومان):</label>
                <input
                  type="number"
                  min="0"
                  placeholder="مثال: 50000000"
                  value={form.targetMonthlySales}
                  onChange={(e) => setForm({ ...form, targetMonthlySales: Number(e.target.value) })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">هدف فروش سالانه (تومان):</label>
                <input
                  type="number"
                  min="0"
                  placeholder="مثال: 600000000"
                  value={form.targetYearlySales}
                  onChange={(e) => setForm({ ...form, targetYearlySales: Number(e.target.value) })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">تعداد مشتری هدف:</label>
                <input
                  type="number"
                  min="0"
                  placeholder="مثال: 50"
                  value={form.targetCustomerCount}
                  onChange={(e) => setForm({ ...form, targetCustomerCount: Number(e.target.value) })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">رنگ شاخص پروژه:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-10 w-16 rounded-xl bg-slate-900 border border-slate-700 cursor-pointer"
                  />
                  <span className="font-mono text-slate-400 text-xs">{form.color}</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و اهداف کلی پروژه:</label>
                <textarea
                  rows={2}
                  placeholder="شرح فعالیت و دامنه این پروژه..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form.independentSalesAllowed}
                onChange={(e) => setForm({ ...form, independentSalesAllowed: e.target.checked })}
                className="rounded text-cyan-500 h-4 w-4"
              />
              <span>فروش مستقل همکاران در این پروژه مجاز باشد</span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                انصراف و بستن
              </button>
              <button
                type="submit"
                className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-xs text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 transition flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>{editingProject ? "ذخیره تغییرات پروژه" : "ثبت و ایجاد پروژه"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
