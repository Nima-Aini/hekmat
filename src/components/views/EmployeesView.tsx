"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  FolderKanban,
  KeyRound,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  X,
  Phone,
  Wallet,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Coins,
  Briefcase,
  Edit3,
  Package,
  Sparkles,
  CheckSquare,
  Square
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
import { toJalaliDate, formatMoney, formatNumber } from "@/lib/dateUtils";
import { MoneyInput } from "@/components/ui/MoneyInput";

const statusText = (s: string) =>
  ({
    active: "فعال",
    on_leave: "مرخصی",
    inactive: "غیرفعال",
    transferred: "قطع همکاری",
    archived: "آرشیو شده",
    pending_offboarding: "در حال خروج",
  }[s] || s);

export const EmployeesView: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [profile, setProfile] = useState<any>();
  const [customers, setCustomers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [commissionSummary, setCommissionSummary] = useState({ totalEarned: 0, totalPaid: 0, balancePending: 0 });
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    amount: 0,
    accountId: "",
    paymentMethod: "bank_transfer",
    referenceNumber: "",
    notes: "",
    projectId: "",
  });
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [openItems, setOpenItems] = useState<any>({ customers: [], tasks: [], invoices: [], commissions: [], consignments: [] });
  const [permissionData, setPermissionData] = useState<any>({ permissions: [], projects: [], account: null });
  const [permissionProjectId, setPermissionProjectId] = useState("");
  const [permissionSet, setPermissionSet] = useState<Record<string, boolean>>({});
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [productAccessData, setProductAccessData] = useState<any>(null);
  const [productAccessLoading, setProductAccessLoading] = useState(false);
  const [productAccessSaving, setProductAccessSaving] = useState(false);
  const [productAccessSearch, setProductAccessSearch] = useState("");
  const [tab, setTab] = useState("overview");

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<any>({
    code: "",
    name: "",
    firstName: "",
    lastName: "",
    mobile: "",
    phone: "",
    nationalId: "",
    avatarUrl: "",
    birthDate: "",
    address: "",
    description: "",
    cooperationType: "visitor",
    role: "visitor",
    status: "active",
    commissionRatePercent: 5,
    commissionBase: "sales_total",
    baseSalary: 0,
    startedAt: "",
    activityScope: "",
    managerId: "",
  });

  const [editForm, setEditForm] = useState<any>({});

  const [account, setAccount] = useState({ username: "", password: "", roleCode: "visitor" });
  const [transfer, setTransfer] = useState({ toEmployeeId: "", projectId: "", reason: "انتقال پرونده مشتریان" });

  const load = async () => {
    setError("");
    try {
      const [e, p] = await Promise.all([
        fetch(`/api/employees?q=${encodeURIComponent(q)}${status ? `&status=${status}` : ""}`).then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
      ]);
      if (!e.success) throw Error(e.error);
      setEmployees(e.employees || []);
      if (p.success) setProjects(p.projects || []);
    } catch (e: any) {
      setError(e.message || "خطا در بارگذاری همکاران");
    }
  };

  useEffect(() => {
    load();
  }, [q, status]);

  // Listen to search navigation
  useEffect(() => {
    const handleNav = (ev: any) => {
      const data = ev.detail;
      if (data && data.type === "employee" && data.id) {
        const found = employees.find((x) => x.id === data.id);
        if (found) {
          open(found);
        } else {
          fetch(`/api/employees/${data.id}`)
            .then((r) => r.json())
            .then((res) => {
              if (res.success && res.employee) open(res.employee);
            });
        }
      }
    };
    window.addEventListener("akma:navigate-item", handleNav);
    return () => window.removeEventListener("akma:navigate-item", handleNav);
  }, [employees]);

  const open = async (emp: any) => {
    setSelected(emp);
    setTab("overview");
    setSelectedCustomerIds([]);
    try {
      const [pr, c, s, cm, oi, pd, prjRes] = await Promise.all([
        fetch(`/api/employees/${emp.id}/profile`).then((r) => r.json()),
        fetch(`/api/employees/${emp.id}/customers`).then((r) => r.json()),
        fetch(`/api/employees/${emp.id}/sales`).then((r) => r.json()),
        fetch(`/api/employees/${emp.id}/commissions`).then((r) => r.json()),
        fetch(`/api/employees/${emp.id}/offboard`).then((r) => r.json()),
        fetch(`/api/employees/${emp.id}/permissions`).then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
      ]);

      if (pr.success) setProfile(pr);
      if (c.success) setCustomers(c.customers || []);
      if (s.success) setSales(s.sales || []);
      if (cm.success) {
        setCommissions(cm.commissions || []);
        if (cm.summary) setCommissionSummary(cm.summary);
        if (cm.accounts) setFinancialAccounts(cm.accounts || []);
      }
      if (oi.success) setOpenItems(oi.openItems || {});
      if (prjRes.success) setProjects(prjRes.projects || []);

      if (pd.success) {
        setPermissionData(pd);
        // Default to the first assigned project OR first system project
        const firstProject = pd.projects?.[0]?.projectId || prjRes.projects?.[0]?.id || "";
        setPermissionProjectId(firstProject);
        const a = pd.projects?.find((x: any) => x.assignment.projectId === firstProject)?.assignment;
        setPermissionSet((a?.permissionSet || {}) as Record<string, boolean>);
        setAccount({ username: pd.account?.username || emp.mobile || "", password: "", roleCode: pd.account?.roleCode || "visitor" });
      }

      await loadProductAccess(emp.id);
    } catch (err) {
      console.error("Error opening employee profile:", err);
    }
  };

  const loadProductAccess = async (empId: string) => {
    setProductAccessLoading(true);
    try {
      const res = await fetch(`/api/employees/${empId}/product-access`).then((r) => r.json());
      if (res.success && res.data) {
        setProductAccessData(res.data);
      }
    } catch (err) {
      console.error("Error loading product access:", err);
    } finally {
      setProductAccessLoading(false);
    }
  };

  const saveProductAccess = async () => {
    if (!selected || !productAccessData) return;
    setProductAccessSaving(true);
    try {
      const res = await fetch(`/api/employees/${selected.id}/product-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canSellAllProducts: productAccessData.canSellAllProducts,
          allowedProductIds: productAccessData.allowedProductIds || [],
          allowedSpecialProductIds: productAccessData.allowedSpecialProductIds || [],
        }),
      }).then((r) => r.json());
      if (!res.success) return alert(res.error || "خطا در ذخیره دسترسی کالاها");
      alert("دسترسی کالاها و محصولات اختصاصی همکار با موفقیت ذخیره شد.");
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setProductAccessSaving(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim() || !form.code.trim()) {
      alert("نام، کد و شماره موبایل همکار الزامی است.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((x) => x.json());
      if (!r.success) return alert(r.error);
      setShowCreate(false);
      await load();
      alert("همکار جدید با موفقیت ثبت شد.");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name || "",
      firstName: selected.firstName || "",
      lastName: selected.lastName || "",
      mobile: selected.mobile || "",
      phone: selected.phone || "",
      nationalId: selected.nationalId || "",
      address: selected.address || "",
      description: selected.description || "",
      cooperationType: selected.cooperationType || "visitor",
      role: selected.role || "visitor",
      status: selected.status || "active",
      commissionRatePercent: selected.commissionRatePercent || 0,
      commissionBase: selected.commissionBase || "sales_total",
      baseSalary: selected.baseSalary || 0,
      activityScope: selected.activityScope || "",
    });
    setShowEdit(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      }).then((r) => r.json());
      if (!res.success) return alert(res.error || "خطا در ذخیره تغییرات");
      alert("اطلاعات همکار با موفقیت ویرایش و ذخیره گردید.");
      setShowEdit(false);
      setSelected(res.employee);
      await load();
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const createAccount = async () => {
    if (!selected) return;
    if (!account.username.trim()) {
      alert("نام کاربری الزامی است.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/employees/${selected.id}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      }).then((x) => x.json());
      if (!r.success) return alert(r.error);
      alert("اطلاعات حساب ورود همکار با موفقیت ذخیره گردید.");
      setShowAccount(false);
    } finally {
      setSaving(false);
    }
  };

  const transferCustomers = async () => {
    if (!selected || !transfer.toEmployeeId) return alert("همکار مقصد را انتخاب نمایید.");
    const ids = selectedCustomerIds;
    if (!ids.length) return alert("حداقل یک مشتری را انتخاب نمایید.");
    const r = await fetch(`/api/employees/${selected.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...transfer, customerIds: ids }),
    }).then((x) => x.json());
    if (!r.success) return alert(r.error);
    alert(`${r.result?.transferred || 0} پرونده مشتری با موفقیت منتقل گردید.`);
    setSelectedCustomerIds([]);
    setShowTransfer(false);
    open(selected);
  };

  const offboard = async () => {
    if (!selected || !confirm("فرآیند خروج همکار شروع شود؟ تمام اطلاعات تاریخی برای گزارش‌ها حفظ می‌شود.")) return;
    const r = await fetch(`/api/employees/${selected.id}/offboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replacementEmployeeId: transfer.toEmployeeId || null, transferReason: "Offboarding از پنل" }),
    }).then((x) => x.json());
    if (!r.success) return alert(r.error);
    alert("فرآیند خروج همکار ثبت گردید.");
    setSelected(null);
    load();
  };

  const changePermissionProject = (projectId: string) => {
    setPermissionProjectId(projectId);
    const a = permissionData.projects?.find((x: any) => x.assignment.projectId === projectId)?.assignment;
    setPermissionSet((a?.permissionSet || {}) as Record<string, boolean>);
  };

  const savePermissions = async () => {
    if (!selected || !permissionProjectId) return alert("لطفاً پروژه موردنظر را انتخاب نمایید.");
    const r = await fetch(`/api/employees/${selected.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: permissionProjectId, permissionSet, role: "member" }),
    }).then((x) => x.json());
    if (!r.success) return alert(r.error);
    alert("سطوح دسترسی همکار برای پروژه با موفقیت ذخیره گردید.");
  };

  const loadCommissions = async (empId: string) => {
    try {
      const res = await fetch(`/api/employees/${empId}/commissions`).then((r) => r.json());
      if (res.success) {
        setCommissions(res.commissions || []);
        if (res.summary) setCommissionSummary(res.summary);
        if (res.accounts) setFinancialAccounts(res.accounts || []);
      }
    } catch (err) {
      console.error("Error loading commissions:", err);
    }
  };

  const openPayoutModal = () => {
    if (!selected) return;
    const defaultAcc = financialAccounts[0]?.id || "";
    setPayoutForm({
      amount: commissionSummary.balancePending || 0,
      accountId: defaultAcc,
      paymentMethod: "bank_transfer",
      referenceNumber: "",
      notes: `تسویه پورسانت به ${selected.name}`,
      projectId: selected.projectId || "",
    });
    setPayoutError("");
    setShowPayoutModal(true);
  };

  const handleCommissionPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || payoutForm.amount <= 0 || !payoutForm.accountId) {
      alert("مبلغ و حساب بانکی پرداختی الزامی هستند.");
      return;
    }

    setPayoutSaving(true);
    setPayoutError("");
    try {
      const res = await fetch(`/api/employees/${selected.id}/commissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payoutForm),
      }).then((r) => r.json());

      if (res.success) {
        setShowPayoutModal(false);
        await loadCommissions(selected.id);
        alert(res.message || "پرداخت پورسانت با موفقیت ثبت شد و در هزینه‌ها درج گردید.");
      } else {
        setPayoutError(res.error || "خطا در ثبت پرداخت پورسانت");
      }
    } catch (err: any) {
      setPayoutError(err.message || "خطا در برقراری ارتباط");
    } finally {
      setPayoutSaving(false);
    }
  };

  const monthlySales = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const k = toJalaliDate(s.invoiceDate, { format: "short" });
      m.set(k, (m.get(k) || 0) + Number(s.grandTotal || 0));
    }
    return Array.from(m.entries())
      .slice(-12)
      .map(([month, value]) => ({ month, sales: value }));
  }, [sales]);

  const monthlyCommission = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of commissions) {
      const k = toJalaliDate(c.createdAt, { format: "short" });
      m.set(k, (m.get(k) || 0) + Number(c.commissionAmount || 0));
    }
    return Array.from(m.entries())
      .slice(-12)
      .map(([month, value]) => ({ month, commission: value }));
  }, [commissions]);

  const summary = useMemo(
    () => ({
      active: employees.filter((e) => e.status === "active").length,
      off: employees.filter((e) => ["transferred", "archived"].includes(e.status)).length,
    }),
    [employees]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex gap-2 items-center">
            <Users className="h-6 w-6 text-purple-400" />
            مدیریت پرسنل، همکاران و ویزیتورها
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            پرونده کامل پرسنلی، مشتریان اختصاصی، فروش، پورسانت‌ها، دسترسی به پروژه‌ها، حساب ورود و تسویه‌حساب
          </p>
        </div>
        <button
          onClick={() => {
            setForm({
              code: `EMP-${Date.now().toString().slice(-5)}`,
              name: "",
              firstName: "",
              lastName: "",
              mobile: "",
              phone: "",
              nationalId: "",
              avatarUrl: "",
              birthDate: "",
              address: "",
              description: "",
              cooperationType: "visitor",
              role: "visitor",
              status: "active",
              commissionRatePercent: 5,
              baseSalary: 0,
              startedAt: "",
              activityScope: "",
              managerId: "",
            });
            setShowCreate(true);
          }}
          className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-white hover:bg-purple-500 transition shadow-lg shadow-purple-600/30"
        >
          <Plus className="h-4 w-4" />
          + تعریف همکار جدید
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">همکاران فعال</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{summary.active}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">قطع همکاری / خروج</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{summary.off}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">کل همکاران ثبت‌شده</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{employees.length}</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو بر اساس نام، شماره موبایل یا کد همکار..."
            className="w-full rounded-xl bg-slate-900 border border-slate-800 px-9 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="on_leave">مرخصی</option>
          <option value="pending_offboarding">در حال خروج</option>
          <option value="transferred">قطع همکاری</option>
          <option value="archived">آرشیو شده</option>
        </select>
      </div>

      {error && <div className="rounded-xl bg-rose-950/30 border border-rose-500/20 p-3 text-xs text-rose-300">{error}</div>}

      {/* Employees Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.map((e) => (
          <button
            key={e.id}
            onClick={() => open(e)}
            className="text-right rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-purple-500/50 hover:bg-slate-900 transition group"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-slate-500 font-mono font-bold">{e.code}</span>
                <h3 className="font-bold text-white text-base mt-1 group-hover:text-purple-300 transition">{e.name}</h3>
                <p className="text-xs text-purple-300 mt-1">
                  نقش: {e.role || "همکار"} · نوع: {e.cooperationType || "ویزیتور"}
                </p>
              </div>
              <NeonBadge
                variant={
                  e.status === "active"
                    ? "green"
                    : e.status === "on_leave"
                    ? "yellow"
                    : e.status === "transferred"
                    ? "red"
                    : "gray"
                }
              >
                {statusText(e.status)}
              </NeonBadge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              <span>شماره تماس: <b className="text-slate-200 font-mono">{e.mobile}</b></span>
              <span>پورسانت: <b className="text-emerald-400 font-bold">{Number(e.commissionRatePercent || 0)}%</b> <span className="text-[10px] text-slate-400 font-normal">({e.commissionBase === "net_profit" ? "سود خالص" : "کل فروش"})</span></span>
              <span>شروع همکاری: <b className="text-slate-300">{toJalaliDate(e.startedAt)}</b></span>
              <span>محدوده: <b className="text-slate-300">{e.activityScope || "عمومی"}</b></span>
            </div>
          </button>
        ))}
      </div>

      {/* Employee Detail Modal */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="max-w-6xl mx-auto rounded-3xl bg-slate-950 border border-slate-800 p-5 md:p-7 space-y-5 my-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{selected.name}</h3>
                  <p className="text-xs text-slate-400">
                    کد: {selected.code} · تماس: <span className="font-mono">{selected.mobile}</span> · وضعیت: {statusText(selected.status)}
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

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-thin">
              {[
                ["overview", "نمای کلی عملکرد", BarChart3],
                ["customers", "مشتریان همکار", Users],
                ["sales", "فاکتورهای فروش", BarChart3],
                ["commission", "پورسانت‌ها", DollarSign],
                ["projects", "پروژه‌های عضو", FolderKanban],
                ["open", "موارد باز", Clock3],
                ["timeline", "لاگ و فعالیت", Clock3],
                ["access", "پروژه‌ها و دسترسی", ShieldCheck],
                ["product_access", "دسترسی کالاها و محصولات", Package],
              ].map(([id, l, I]: any) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-3 py-2 rounded-xl text-xs whitespace-nowrap flex items-center gap-2 transition ${
                    tab === id ? "bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <I className="h-4 w-4" />
                  {l}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="space-y-5">
                {profile?.reports && (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[
                      ["فروش امروز", profile.reports.today?.todaySales, true],
                      ["فروش ماه جاری", profile.reports.month?.periodSales, true],
                      ["فروش کل سال", profile.reports.year?.periodSales, true],
                      ["مشتریان فعال", profile.reports.month?.customers, false],
                      ["پورسانت ماه", profile.reports.month?.periodCommission, true],
                      ["پورسانت تسویه نشده", profile.reports.month?.unpaidCommission, true],
                    ].map(([l, v, isCurr]: any) => (
                      <div key={l} className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5">
                        <p className="text-[11px] text-slate-400 font-medium">{l}</p>
                        <b className="text-white text-sm mt-1 block">{isCurr ? formatMoney(v) : formatNumber(v)}</b>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <h4 className="font-bold text-white text-sm mb-4">روند فروش ماهانه</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlySales}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip />
                          <Line type="monotone" dataKey="sales" stroke="#a78bfa" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <h4 className="font-bold text-white text-sm mb-4">روند پورسانت‌های دریافتی</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyCommission}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip />
                          <Bar dataKey="commission" fill="#22d3ee" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-4">
                  <button
                    onClick={openEditModal}
                    className="rounded-xl bg-purple-600/20 border border-purple-500/40 px-4 py-2.5 text-xs font-bold text-purple-300 flex items-center gap-2 hover:bg-purple-600/30 transition"
                  >
                    <Edit3 className="h-4 w-4" />
                    ویرایش اطلاعات پرسنل
                  </button>
                  <button
                    onClick={() => setShowAccount(true)}
                    className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs text-white flex items-center gap-2 hover:bg-slate-700 transition"
                  >
                    <KeyRound className="h-4 w-4 text-cyan-400" />
                    حساب و کلمه عبور ورود همکار
                  </button>
                  <button
                    onClick={() => setShowTransfer(true)}
                    className="rounded-xl bg-amber-950/40 border border-amber-500/30 px-4 py-2.5 text-xs text-amber-300 flex items-center gap-2 hover:bg-amber-900/40 transition"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    انتقال پرونده مشتریان به همکار دیگر
                  </button>
                  <button
                    onClick={offboard}
                    className="rounded-xl bg-rose-950/40 border border-rose-500/30 px-4 py-2.5 text-xs text-rose-300 flex items-center gap-2 hover:bg-rose-900/40 transition mr-auto"
                  >
                    <UserX className="h-4 w-4" />
                    شروع فرآیند خروج پرسنلی (Offboarding)
                  </button>
                </div>
              </div>
            )}

            {tab === "customers" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => setSelectedCustomerIds(customers.map((c) => c.id))} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
                    انتخاب همه ({customers.length})
                  </button>
                  <button onClick={() => setSelectedCustomerIds([])} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
                    لغو انتخاب
                  </button>
                  <span className="text-xs text-slate-500">{selectedCustomerIds.length} مشتری انتخاب شده</span>
                  {selectedCustomerIds.length > 0 && (
                    <button onClick={() => setShowTransfer(true)} className="mr-auto rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-lg">
                      انتقال مشتریان انتخاب‌شده
                    </button>
                  )}
                </div>
                <div className="responsive-table overflow-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 bg-slate-900 border-b border-slate-800">
                        <th className="p-3 w-10">
                          <input
                            type="checkbox"
                            checked={customers.length > 0 && selectedCustomerIds.length === customers.length}
                            onChange={(e) => setSelectedCustomerIds(e.target.checked ? customers.map((c) => c.id) : [])}
                          />
                        </th>
                        <th className="p-3 text-right">نام مشتری / فروشگاه</th>
                        <th className="p-3 text-center">شماره تماس</th>
                        <th className="p-3 text-center">امتیاز سلامت</th>
                        <th className="p-3 text-center">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-900/50">
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCustomerIds.includes(c.id)}
                              onChange={(e) =>
                                setSelectedCustomerIds((v) => (e.target.checked ? [...v, c.id] : v.filter((id) => id !== c.id)))
                              }
                            />
                          </td>
                          <td className="p-3 font-bold text-white">{c.storeName || c.name}</td>
                          <td className="p-3 text-center text-slate-300 font-mono">{c.mobile}</td>
                          <td className="p-3 text-center">{c.healthScore || 100}</td>
                          <td className="p-3 text-center">
                            <NeonBadge variant={c.status === "active" ? "green" : "gray"}>{c.status === "active" ? "فعال" : "غیرفعال"}</NeonBadge>
                          </td>
                        </tr>
                      ))}
                      {customers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500">
                            مشتری تحت پوشش این همکار ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "sales" && (
              <div className="responsive-table overflow-auto rounded-2xl border border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 bg-slate-900 border-b border-slate-800">
                      <th className="p-3 text-right">شماره فاکتور</th>
                      <th className="p-3 text-center">تاریخ (شمسی)</th>
                      <th className="p-3 text-center">مبلغ کل فاکتور</th>
                      <th className="p-3 text-center">وضعیت پرداخت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-mono font-bold text-purple-400">{s.invoiceNumber}</td>
                        <td className="p-3 text-center text-slate-300">{toJalaliDate(s.invoiceDate)}</td>
                        <td className="p-3 text-center font-bold text-white">{formatMoney(s.grandTotal)}</td>
                        <td className="p-3 text-center">{s.paymentStatus}</td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-500">
                          فاکتور فروشی برای این همکار ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "commission" && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-4">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                      <span>کل پورسانت کسب‌شده</span>
                      <Coins className="h-4 w-4" />
                    </div>
                    <div className="text-lg font-black text-emerald-300 font-mono mt-1">
                      {formatMoney(commissionSummary.totalEarned)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">ناشی از فاکتورهای فروش</div>
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-purple-950/30 p-4">
                    <div className="flex items-center justify-between text-xs text-purple-400 font-semibold">
                      <span>کل پورسانت‌های پرداخت‌شده</span>
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="text-lg font-black text-purple-300 font-mono mt-1">
                      {formatMoney(commissionSummary.totalPaid)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">ثبت شده در هزینه‌های سیستم</div>
                  </div>

                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/30 p-4">
                    <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold">
                      <span>مانده پورسانت قابل پرداخت</span>
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="text-lg font-black text-cyan-300 font-mono mt-1">
                      {formatMoney(commissionSummary.balancePending)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">طلب همکار از مجموعه</div>
                  </div>
                </div>

                {/* Header Action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                      دفتر سوابق پورسانت و تسویه‌حساب‌های مالی همکار
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      پرداخت پورسانت به صورت خودکار سند هزینه صادر کرده و از موجودی حساب بانکی کسر می‌کند.
                    </p>
                  </div>
                  <button
                    onClick={openPayoutModal}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:opacity-95 transition flex items-center gap-1.5 shrink-0"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>ثبت پرداخت / تسویه پورسانت</span>
                  </button>
                </div>

                {/* Commissions & Payouts Ledger Table */}
                <div className="responsive-table overflow-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 bg-slate-900 border-b border-slate-800">
                        <th className="p-3 text-right">نوع تراکنش</th>
                        <th className="p-3 text-right">مبلغ پورسانت / پرداختی</th>
                        <th className="p-3 text-center">مبنا / شماره فاکتور</th>
                        <th className="p-3 text-right">توضیحات و بابت</th>
                        <th className="p-3 text-center">وضعیت</th>
                        <th className="p-3 text-center">تاریخ ثبت (شمسی)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {commissions.map((c) => {
                        const isPayout = c.commissionType === "payout" || Number(c.commissionAmount) < 0;
                        return (
                          <tr key={c.id} className="hover:bg-slate-900/50">
                            <td className="p-3">
                              {isPayout ? (
                                <span className="inline-flex items-center gap-1 text-purple-300 font-bold bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-lg text-[11px]">
                                  <ArrowDownRight className="h-3.5 w-3.5 text-purple-400" />
                                  پرداخت به همکار
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-300 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[11px]">
                                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                                  کسب پورسانت فروش
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-bold font-mono">
                              {isPayout ? (
                                <span className="text-purple-400">
                                  - {formatMoney(Math.abs(Number(c.commissionAmount)))}
                                </span>
                              ) : (
                                <span className="text-emerald-400">
                                  + {formatMoney(Number(c.commissionAmount))}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center text-slate-300 font-mono">
                              {c.invoiceId ? (
                                <span className="text-cyan-300">فاکتور</span>
                              ) : c.baseAmount ? (
                                formatMoney(c.baseAmount)
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3 text-slate-300 text-[11px]">
                              <div>{c.notes || "—"}</div>
                              {c.ruleSnapshot?.paymentNumber && (
                                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                  سند پرداخت: {c.ruleSnapshot.paymentNumber}
                                  {c.ruleSnapshot.accountName ? ` | ${c.ruleSnapshot.accountName}` : ""}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {c.status === "paid" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-300 text-[10px] bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  <CheckCircle2 className="h-3 w-3" />
                                  تسویه شده
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-300 text-[10px] bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  <Clock3 className="h-3 w-3" />
                                  در انتظار پرداخت
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center text-slate-400">
                              {toJalaliDate(c.createdAt, { showTime: true })}
                            </td>
                          </tr>
                        );
                      })}
                      {commissions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            هنوز هیچ پورسانت یا پرداختی برای این همکار ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "projects" && (
              <div className="grid md:grid-cols-2 gap-3">
                {(profile?.projects || []).map((p: any) => (
                  <div key={p.assignment.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <b className="text-white text-sm">{p.project?.name || "پروژه"}</b>
                      <NeonBadge variant={p.assignment.status === "active" ? "green" : "gray"}>
                        {p.assignment.status === "active" ? "فعال" : "غیرفعال"}
                      </NeonBadge>
                    </div>
                    <p className="text-xs text-slate-400">
                      نقش: <span className="text-slate-200 font-semibold">{p.assignment.role}</span> · پورسانت:{" "}
                      <span className="text-cyan-300 font-bold">{p.assignment.commissionRate ?? "-"}%</span> · حقوق پروژه:{" "}
                      <span className="text-emerald-300 font-bold">{formatMoney(p.assignment.projectSalary)}</span>
                    </p>
                  </div>
                ))}
                {!(profile?.projects || []).length && (
                  <p className="text-slate-500 p-6 text-center col-span-2">این همکار هنوز در پروژه‌ای عضو نشده است.</p>
                )}
              </div>
            )}

            {/* Access & Projects Tab - Fully supports all system projects */}
            {tab === "access" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-purple-400" />
                      مدیریت پروژه‌ها و سطوح دسترسی همکار
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      حساب کاربری: <span className="text-cyan-300 font-bold">{permissionData.account?.username || "ثبت نشده"}</span> · آخرین ورود:{" "}
                      <span className="text-slate-300">{toJalaliDate(permissionData.account?.lastLoginAt, { showTime: true })}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 font-semibold shrink-0">انتخاب پروژه:</label>
                    <select
                      value={permissionProjectId}
                      onChange={(e) => changePermissionProject(e.target.value)}
                      className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-bold outline-none focus:border-purple-500"
                    >
                      <option value="">-- تمام پروژه‌ها --</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-slate-300 font-semibold block">دسترسی‌های فعال در این پروژه:</span>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {(permissionData.permissions || []).map((p: any) => (
                      <label
                        key={p.code}
                        className="flex items-center gap-2.5 rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 hover:border-purple-500/50 cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={permissionSet[p.code] !== false}
                          onChange={(e) => setPermissionSet((v) => ({ ...v, [p.code]: e.target.checked }))}
                          className="rounded text-purple-500 h-4 w-4"
                        />
                        <span className="font-medium">{p.name || p.code}</span>
                        <span className="text-[9px] text-slate-500 mr-auto font-mono">{p.code}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button
                    onClick={savePermissions}
                    className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    ذخیره سطوح دسترسی پروژه
                  </button>
                </div>
              </div>
            )}

            {/* Product Access Tab */}
            {tab === "product_access" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Package className="h-5 w-5 text-cyan-400" />
                      مدیریت دسترسی کالاهای قابل فروش ویزیتور / همکار
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      تعیین کنید این همکار در زمان صدور فاکتور، به کدام کالاهای کاتالوگ و کدام محصولات اختصاصی دسترسی داشته باشد.
                    </p>
                  </div>

                  <button
                    onClick={saveProductAccess}
                    disabled={productAccessSaving}
                    className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-600/30 hover:opacity-90 transition flex items-center gap-2 shrink-0 self-start md:self-auto"
                  >
                    <Save className="h-4 w-4" />
                    {productAccessSaving ? "در حال ذخیره..." : "ذخیره دسترسی‌های فروش کالا"}
                  </button>
                </div>

                {productAccessLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400">در حال بارگذاری لیست کالاها و دسترسی‌ها...</div>
                ) : !productAccessData ? (
                  <div className="p-8 text-center text-xs text-slate-500">اطلاعاتی یافت نشد.</div>
                ) : (
                  <div className="space-y-5">
                    {/* Master Switch */}
                    <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          دسترسی کامل و نامحدود به تمامی کالاها
                        </span>
                        <p className="text-[11px] text-slate-400">
                          در صورت فعال بودن، این همکار می‌تواند برای تمامی کالاهای کاتالوگ و تمامی محصولات اختصاصی فاکتور صادر نماید.
                        </p>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productAccessData.canSellAllProducts}
                          onChange={(e) =>
                            setProductAccessData({
                              ...productAccessData,
                              canSellAllProducts: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    {!productAccessData.canSellAllProducts && (
                      <div className="space-y-5">
                        {/* Search Filter */}
                        <div className="relative">
                          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                          <input
                            type="text"
                            placeholder="جستجو در بین نام کالاها، کد کالا یا دسته‌بندی..."
                            value={productAccessSearch}
                            onChange={(e) => setProductAccessSearch(e.target.value)}
                            className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-10 pl-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
                          />
                        </div>

                        {/* Section 1: Special Products */}
                        <div className="space-y-3 rounded-2xl bg-slate-950/70 border border-purple-900/40 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-400" />
                              <h5 className="text-xs font-bold text-white">
                                محصولات اختصاصی (Special Products)
                              </h5>
                              <span className="rounded-full bg-purple-950 border border-purple-500/40 px-2 py-0.5 text-[10px] text-purple-300 font-bold font-mono">
                                {(productAccessData.allSpecialProducts || []).length} مورد
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => {
                                  const allSpIds = (productAccessData.allSpecialProducts || []).map((p: any) => p.id);
                                  setProductAccessData({
                                    ...productAccessData,
                                    allowedSpecialProductIds: allSpIds,
                                  });
                                }}
                                className="text-purple-400 hover:text-purple-300 font-semibold"
                              >
                                انتخاب همه
                              </button>
                              <span className="text-slate-600">|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setProductAccessData({
                                    ...productAccessData,
                                    allowedSpecialProductIds: [],
                                  });
                                }}
                                className="text-slate-400 hover:text-white"
                              >
                                لغو همه
                              </button>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {(productAccessData.allSpecialProducts || [])
                              .filter((sp: any) => {
                                if (!productAccessSearch.trim()) return true;
                                const q = productAccessSearch.toLowerCase();
                                return (
                                  sp.name?.toLowerCase().includes(q) ||
                                  sp.code?.toLowerCase().includes(q) ||
                                  sp.category?.toLowerCase().includes(q)
                                );
                              })
                              .map((sp: any) => {
                                const isChecked = (productAccessData.allowedSpecialProductIds || []).includes(sp.id);
                                return (
                                  <label
                                    key={sp.id}
                                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs cursor-pointer transition ${
                                      isChecked
                                        ? "bg-purple-950/40 border-purple-500/60 text-white"
                                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const current = productAccessData.allowedSpecialProductIds || [];
                                        const next = e.target.checked
                                          ? [...current, sp.id]
                                          : current.filter((id: string) => id !== sp.id);
                                        setProductAccessData({
                                          ...productAccessData,
                                          allowedSpecialProductIds: next,
                                        });
                                      }}
                                      className="mt-0.5 rounded text-purple-600 h-4 w-4"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold truncate text-slate-100">{sp.name}</span>
                                        <span className="text-[10px] text-purple-400 font-mono font-bold shrink-0">{sp.code}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                        <span>دسته: {sp.category || "اختصاصی"}</span>
                                        <span className="font-mono text-emerald-400 font-semibold">
                                          {formatMoney(sp.basePrice)}
                                        </span>
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            {(productAccessData.allSpecialProducts || []).length === 0 && (
                              <p className="text-xs text-slate-500 col-span-3 text-center py-4">
                                هنوز هیچ محصول اختصاصی در سیستم ثبت نشده است.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Section 2: Catalog Products */}
                        <div className="space-y-3 rounded-2xl bg-slate-950/70 border border-slate-800 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-cyan-400" />
                              <h5 className="text-xs font-bold text-white">
                                کالاهای کاتالوگ سازمانی و کارخانه‌ای
                              </h5>
                              <span className="rounded-full bg-slate-900 border border-slate-700 px-2 py-0.5 text-[10px] text-cyan-300 font-bold font-mono">
                                {(productAccessData.allProducts || []).length} مورد
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => {
                                  const allPrdIds = (productAccessData.allProducts || []).map((p: any) => p.id);
                                  setProductAccessData({
                                    ...productAccessData,
                                    allowedProductIds: allPrdIds,
                                  });
                                }}
                                className="text-cyan-400 hover:text-cyan-300 font-semibold"
                              >
                                انتخاب همه
                              </button>
                              <span className="text-slate-600">|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setProductAccessData({
                                    ...productAccessData,
                                    allowedProductIds: [],
                                  });
                                }}
                                className="text-slate-400 hover:text-white"
                              >
                                لغو همه
                              </button>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {(productAccessData.allProducts || [])
                              .filter((p: any) => {
                                if (!productAccessSearch.trim()) return true;
                                const q = productAccessSearch.toLowerCase();
                                return (
                                  p.name?.toLowerCase().includes(q) ||
                                  p.code?.toLowerCase().includes(q) ||
                                  p.category?.toLowerCase().includes(q)
                                );
                              })
                              .map((p: any) => {
                                const isChecked = (productAccessData.allowedProductIds || []).includes(p.id);
                                return (
                                  <label
                                    key={p.id}
                                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs cursor-pointer transition ${
                                      isChecked
                                        ? "bg-cyan-950/40 border-cyan-500/60 text-white"
                                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const current = productAccessData.allowedProductIds || [];
                                        const next = e.target.checked
                                          ? [...current, p.id]
                                          : current.filter((id: string) => id !== p.id);
                                        setProductAccessData({
                                          ...productAccessData,
                                          allowedProductIds: next,
                                        });
                                      }}
                                      className="mt-0.5 rounded text-cyan-600 h-4 w-4"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold truncate text-slate-100">{p.name}</span>
                                        <span className="text-[10px] text-cyan-400 font-mono font-bold shrink-0">{p.code}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                        <span>دسته: {p.category || "عمومی"}</span>
                                        <span className="font-mono text-emerald-400 font-semibold">
                                          {formatMoney(p.basePrice)}
                                        </span>
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-700 px-5 py-2 text-xs text-slate-300 hover:text-white"
              >
                بستن پنجره پرونده
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Employee */}
      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <form
            onSubmit={create}
            className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                تعریف پرونده پرسنلی و همکار جدید
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-xs"
              >
                <X className="h-4 w-4" />
                <span>بستن</span>
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  کد پرسنلی اختصاصی <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="مثال: EMP-101"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام کامل نمایشی <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="مثال: علی احمدی"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  شماره موبایل اصلی <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="09123456789"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">تلفن ثابت / تماس دوم:</label>
                <input
                  placeholder="021..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">کد ملی ۱۰ رقمی:</label>
                <input
                  placeholder="0012345678"
                  value={form.nationalId}
                  onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">نوع همکاری:</label>
                <select
                  value={form.cooperationType}
                  onChange={(e) => setForm({ ...form, cooperationType: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white"
                >
                  <option value="visitor">ویزیتور (فروش میدانی)</option>
                  <option value="seller">فروشنده تلفنی / حضوری</option>
                  <option value="employee">کارمند دفتری</option>
                  <option value="representative">نماینده استانی</option>
                  <option value="project">همکار پروژه‌ای</option>
                  <option value="independent">همکار مستقل</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">عنوان نقش شغلی:</label>
                <input
                  placeholder="مثال: سرپرست فروش تهران"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">درصد پورسانت پیش‌فرض (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="مثال: 5"
                  value={form.commissionRatePercent}
                  onChange={(e) => setForm({ ...form, commissionRatePercent: Number(e.target.value) })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">مبنای محاسبه پورسانت:</label>
                <select
                  value={form.commissionBase || "sales_total"}
                  onChange={(e) => setForm({ ...form, commissionBase: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white font-semibold"
                >
                  <option value="sales_total">مبلغ کل فروش فاکتور (پیش‌فرض)</option>
                  <option value="net_profit">سود خالص فاکتور (فروش منهای بهای تمام شده)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">حقوق پایه ماهانه:</label>
                <MoneyInput
                  value={form.baseSalary}
                  onChange={(val) => setForm({ ...form, baseSalary: val })}
                  className="w-full text-xs py-2"
                  unit="تومان"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">محدوده فعالیت جغرافیایی:</label>
                <input
                  placeholder="مثال: تهران - منطقه بازار و لاله زار"
                  value={form.activityScope}
                  onChange={(e) => setForm({ ...form, activityScope: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">آدرس محل سکونت:</label>
                <input
                  placeholder="تهران، خیابان..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و سوابق پرسنلی:</label>
                <textarea
                  rows={2}
                  placeholder="توضیحات تکمیلی..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                انصراف و بستن
              </button>
              <button
                disabled={saving}
                type="submit"
                className="rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? "در حال ذخیره..." : "ثبت پرونده پرسنلی"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Account & Password */}
      {showAccount && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAccount(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-purple-400" />
                حساب ورود اختصاصی همکار
              </h3>
              <button onClick={() => setShowAccount(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">نام کاربری / شماره موبایل:</label>
                <input
                  value={account.username}
                  onChange={(e) => setAccount({ ...account, username: e.target.value })}
                  placeholder="مثال: 09123456789"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">کلمه عبور جدید (در صورت تغییر وارد کنید):</label>
                <input
                  type="password"
                  value={account.password}
                  onChange={(e) => setAccount({ ...account, password: e.target.value })}
                  placeholder="رمز عبور ورود به پنل"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">سطح دسترسی نقش پایه:</label>
                <select
                  value={account.roleCode}
                  onChange={(e) => setAccount({ ...account, roleCode: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white"
                >
                  <option value="visitor">ویزیتور (فقط دسترسی به ثبت سفارش و مشتریان خود)</option>
                  <option value="sales">کارشناس فروش</option>
                  <option value="accountant">حسابدار</option>
                  <option value="manager">مدیر سیستم (دسترسی کامل)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setShowAccount(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400">
                انصراف
              </button>
              <button onClick={createAccount} className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-lg">
                ذخیره حساب ورود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee */}
      {showEdit && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEdit(false);
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-purple-400" />
                ویرایش اطلاعات پرونده پرسنلی همکار ({selected?.name})
              </h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نام کامل نمایشی:</label>
                  <input
                    required
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">شماره تلفن همراه:</label>
                  <input
                    required
                    value={editForm.mobile || ""}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تلفن ثابت / داخلی:</label>
                  <input
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">کد ملی:</label>
                  <input
                    value={editForm.nationalId || ""}
                    onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نوع همکاری:</label>
                  <select
                    value={editForm.cooperationType || "visitor"}
                    onChange={(e) => setEditForm({ ...editForm, cooperationType: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  >
                    <option value="visitor">ویزیتور و بازاریاب حضوری</option>
                    <option value="sales">کارشناس فروش تلفنی/ستادی</option>
                    <option value="accountant">حسابدار و امور مالی</option>
                    <option value="admin">مدیر سیستم</option>
                    <option value="employee">پرسنل سازمانی</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">وضعیت فعالیت پرسنل:</label>
                  <select
                    value={editForm.status || "active"}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  >
                    <option value="active">فعال و شاغل</option>
                    <option value="on_leave">مرخصی</option>
                    <option value="inactive">غیرفعال موقت</option>
                    <option value="transferred">قطع همکاری / تسویه‌شده</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">درصد پورسانت فروش (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.commissionRatePercent ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, commissionRatePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">مبنای محاسبه پورسانت:</label>
                  <select
                    value={editForm.commissionBase || "sales_total"}
                    onChange={(e) => setEditForm({ ...editForm, commissionBase: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  >
                    <option value="sales_total">مبلغ کل فروش فاکتور</option>
                    <option value="net_profit">سود خالص فاکتور (فروش - بهای تمام شده)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">حقوق پایه ماهیانه (تومان):</label>
                  <input
                    type="number"
                    value={editForm.baseSalary ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, baseSalary: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">حوزه و منطقه فعالیت ویزیتوری:</label>
                <input
                  placeholder="مثال: منطقه بازار بزرگ تهران، لاله زار، خیابان خیام"
                  value={editForm.activityScope || ""}
                  onChange={(e) => setEditForm({ ...editForm, activityScope: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">آدرس سکونت / تماس:</label>
                <input
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و سوابق پرسنلی:</label>
                <textarea
                  rows={2}
                  value={editForm.description || ""}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-lg hover:bg-purple-500 transition flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "در حال ذخیره..." : "ذخیره تغییرات پرونده"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Customers */}
      {showTransfer && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTransfer(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-amber-400" />
                انتقال امن پرونده مشتریان
              </h3>
              <button onClick={() => setShowTransfer(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              با انتقال مشتری، سوابق فاکتورها، مانده حساب و تاریخچه حفظ شده و مسئولیت به همکار جدید واگذار می‌شود.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">همکار مقصد (مسئول جدید):</label>
                <select
                  value={transfer.toEmployeeId}
                  onChange={(e) => setTransfer({ ...transfer, toEmployeeId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white"
                >
                  <option value="">-- انتخاب همکار مقصد --</option>
                  {employees
                    .filter((e) => e.id !== selected?.id && e.status === "active")
                    .map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.name} ({e.role || "همکار"}) - {e.mobile}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">علت و دلیل انتقال:</label>
                <textarea
                  value={transfer.reason}
                  onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setShowTransfer(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400">
                انصراف
              </button>
              <button onClick={transferCustomers} className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-lg flex items-center gap-1.5">
                <ArrowRightLeft className="h-4 w-4" />
                تأیید و انتقال پرونده‌ها
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Commission Payout */}
      {showPayoutModal && selected && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPayoutModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/30 p-2 text-emerald-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    ثبت پرداخت پورسانت به {selected.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    مانده قابل پرداخت:{" "}
                    <span className="font-bold text-emerald-400 font-mono">
                      {formatMoney(commissionSummary.balancePending)}
                    </span>
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPayoutModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {payoutError && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 leading-relaxed">
                {payoutError}
              </div>
            )}

            <form onSubmit={handleCommissionPayout} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">مبلغ پرداختی (تومان):</label>
                  {commissionSummary.balancePending > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayoutForm({ ...payoutForm, amount: commissionSummary.balancePending })}
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <span>تسویه کامل کل مانده</span>
                    </button>
                  )}
                </div>
                <MoneyInput
                  value={payoutForm.amount}
                  onChange={(val) => setPayoutForm({ ...payoutForm, amount: val })}
                  className="w-full text-sm"
                  unit="تومان"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  حساب بانکی / صندوق پرداخت‌کننده:
                </label>
                <select
                  value={payoutForm.accountId}
                  onChange={(e) => setPayoutForm({ ...payoutForm, accountId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                  required
                >
                  <option value="">-- انتخاب حساب پرداخت --</option>
                  {financialAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.bankName || "بانک"}) - موجودی فعلی: {formatMoney(a.balance)}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  مبلغ پرداختی مستقیماً از موجودی این حساب کسر خواهد شد (موجودی نمی‌تواند منفی شود).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">روش پرداخت:</label>
                  <select
                    value={payoutForm.paymentMethod}
                    onChange={(e) => setPayoutForm({ ...payoutForm, paymentMethod: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                  >
                    <option value="bank_transfer">حواله پایا / ساتنا</option>
                    <option value="card_transfer">کارت به کارت</option>
                    <option value="pos">دستگاه کارتخوان (POS)</option>
                    <option value="cash">پرداخت نقدی</option>
                    <option value="cheque">چک بانکی</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">شماره سند / کد پیگیری:</label>
                  <input
                    type="text"
                    value={payoutForm.referenceNumber}
                    onChange={(e) => setPayoutForm({ ...payoutForm, referenceNumber: e.target.value })}
                    placeholder="مثال: ۱۲۳۴۵۶۷۸"
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و بابت:</label>
                <input
                  type="text"
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  placeholder="بابت تسویه پورسانت ماه..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2.5 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={payoutSaving}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-emerald-600/30 hover:opacity-95 transition"
                >
                  {payoutSaving ? "در حال ثبت پرداخت..." : "تأیید و صدور سند پرداخت"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
