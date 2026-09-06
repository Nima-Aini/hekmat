"use client";
import { retryableRequest } from "@/lib/retryableRequest";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  FilePlus2,
  LogOut,
  Plus,
  Receipt,
  RefreshCcw,
  Users,
  Wallet,
  X,
  MapPin,
  Phone,
  Building,
  CheckCircle2,
  Calendar,
  CreditCard,
  Edit2,
  DollarSign,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  UserCheck,
  ShieldCheck,
  Search,
  Menu
} from "lucide-react";
import { toJalaliDate, formatMoney, formatNumber } from "@/lib/dateUtils";
import { NeshanMapPicker } from "@/components/maps/NeshanMapPicker";

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [roleCode, setRoleCode] = useState<string>("visitor");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [dash, setDash] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any>({ products: [], projects: [], accounts: [] });
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals
  const [showCustomer, setShowCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [editInvoice, setEditInvoice] = useState<any | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const [customerForm, setCustomerForm] = useState<any>({
    name: "",
    storeName: "",
    mobile: "",
    phone: "",
    address: "",
    city: "تهران",
    creditLimit: "",
    paymentTermsDays: "30",
    latitude: null as number | null,
    longitude: null as number | null,
    notes: "",
    projectId: "",
  });

  const [invoiceForm, setInvoiceForm] = useState<any>({
    customerId: "",
    projectId: "",
    items: [{ productId: "", quantity: 1, unitPrice: "" }],
    notes: "",
    dueDate: "",
    initialPaymentAmount: "",
    accountId: "",
    paymentMethod: "pos",
  });

  const [paymentForm, setPaymentForm] = useState<any>({
    paymentType: "customer_receipt",
    customerId: "",
    supplierId: "",
    accountId: "",
    amount: "",
    paymentMethod: "pos",
    referenceNumber: "",
    notes: "",
  });

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const m = await fetch("/api/auth/employee-me", { cache: "no-store" }).then((x) => x.json());
      if (!m.success) {
        router.push("/employee-login");
        return;
      }
      setMe(m.employee);
      setPermissions(new Set(Array.isArray(m.permissions) ? m.permissions : []));
      const currentRole = m.role?.code || m.employee?.role || "visitor";
      setRoleCode(currentRole);

      // If admin, they can go to master or stay here
      const [d, c, i, cat, pay] = await Promise.allSettled([
        fetch(`/api/employees/${m.employee.id}/dashboard`, { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/customers?pageSize=100", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/invoices?pageSize=100", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/employee/catalog", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/payments", { cache: "no-store" }).then((x) => x.json()),
      ]);

      if (d.status === "fulfilled" && d.value.success) setDash(d.value.dashboard);
      if (c.status === "fulfilled" && c.value.success) setCustomers(c.value.customers || []);
      if (i.status === "fulfilled" && i.value.success) setInvoices(i.value.invoices || []);
      if (cat.status === "fulfilled" && cat.value.success) setCatalog(cat.value);
      if (pay.status === "fulfilled" && pay.value.success) setPayments(pay.value.payments || []);
    } catch (e: any) {
      setError(e?.message || "خطا در دریافت اطلاعات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(
    () =>
      invoiceForm.items.reduce(
        (s: number, x: any) => s + (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0),
        0
      ),
    [invoiceForm.items]
  );

  const products = catalog.products || [];
  const projects = catalog.projects || [];
  const accounts = catalog.accounts || [];

  const isAccountant = roleCode === "accountant" || roleCode === "admin" || roleCode === "manager";
  const can = (permission: string) => permissions.has("*") || permissions.has(permission);

  function selectProduct(i: number, id: string) {
    const p = products.find((x: any) => x.id === id);
    setInvoiceForm((f: any) => {
      const items = [...f.items];
      items[i] = { ...items[i], productId: id, unitPrice: p?.basePrice ?? "" };
      return { ...f, items };
    });
  }

  function updateItem(i: number, k: string, v: any) {
    setInvoiceForm((f: any) => {
      const items = [...f.items];
      items[i] = { ...items[i], [k]: v };
      return { ...f, items };
    });
  }

  const openCustomerModal = (cust: any = null) => {
    if (cust) {
      setEditingCustomer(cust);
      setCustomerForm({
        name: cust.name || "",
        storeName: cust.storeName || "",
        mobile: cust.mobile || "",
        phone: cust.phone || "",
        address: cust.address || "",
        city: cust.city || "تهران",
        creditLimit: cust.creditLimit ? String(cust.creditLimit) : "",
        paymentTermsDays: cust.paymentTermsDays ? String(cust.paymentTermsDays) : "30",
        latitude: cust.latitude ? Number(cust.latitude) : null,
        longitude: cust.longitude ? Number(cust.longitude) : null,
        notes: cust.notes || "",
        projectId: cust.projectId || "",
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({
        name: "",
        storeName: "",
        mobile: "",
        phone: "",
        address: "",
        city: "تهران",
        creditLimit: "",
        paymentTermsDays: "30",
        latitude: null,
        longitude: null,
        notes: "",
        projectId: projects[0]?.id || "",
      });
    }
    setShowCustomer(true);
  };

  async function saveCustomer(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";

      const x = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(customerForm),
      }).then((r) => r.json());

      if (!x.success) throw Error(x.error);
      setShowCustomer(false);
      setEditingCustomer(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveInvoice(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!invoiceForm.customerId || invoiceForm.items.some((x: any) => !x.productId || Number(x.quantity) <= 0)) {
        throw Error("انتخاب مشتری و حداقل یک کالا با تعداد معتبر الزامی است.");
      }

      const initial = Number(invoiceForm.initialPaymentAmount || 0);
      if (initial > 0 && !invoiceForm.accountId) {
        throw Error("برای ثبت پرداخت اولیه، انتخاب حساب واریزی الزامی است.");
      }

      const x = await retryableRequest("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: invoiceForm.customerId,
          projectId: invoiceForm.projectId || null,
          salesMode: isAccountant ? "direct" : "visitor",
          employeeId: me.id,
          items: invoiceForm.items.map((x: any) => ({
            productId: x.productId,
            quantity: Number(x.quantity),
            unitPrice: Number(x.unitPrice) || undefined,
          })),
          notes: invoiceForm.notes || undefined,
          dueDate: invoiceForm.dueDate || undefined,
          initialPayment:
            initial > 0
              ? {
                  amount: initial,
                  accountId: invoiceForm.accountId,
                  paymentMethod: invoiceForm.paymentMethod,
                }
              : undefined,
        }),
      }).then((r) => r.json());

      if (!x.success) throw Error(x.error);
      setShowInvoice(false);
      setInvoiceForm({
        customerId: "",
        projectId: "",
        items: [{ productId: "", quantity: 1, unitPrice: "" }],
        notes: "",
        dueDate: "",
        initialPaymentAmount: "",
        accountId: "",
        paymentMethod: "pos",
      });
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateInvoice(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const x = await fetch(`/api/invoices/${editInvoice.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          notes: editInvoice.notes,
          dueDate: editInvoice.dueDate || null,
          paymentStatus: editInvoice.paymentStatus,
        }),
      }).then((r) => r.json());
      if (!x.success) throw Error(x.error);
      setEditInvoice(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePayment(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!paymentForm.accountId || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
        throw Error("انتخاب حساب و مبلغ معتبر الزامی است.");
      }
      const x = await retryableRequest("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: paymentForm.accountId,
          amount: Number(paymentForm.amount),
          paymentType: paymentForm.paymentType,
          customerId: paymentForm.customerId || undefined,
          supplierId: paymentForm.supplierId || undefined,
          paymentMethod: paymentForm.paymentMethod,
          referenceNumber: paymentForm.referenceNumber || undefined,
          notes: paymentForm.notes || undefined,
        }),
      }).then((r) => r.json());

      if (!x.success) throw Error(x.error);
      setShowPayment(false);
      setPaymentForm({
        paymentType: "customer_receipt",
        customerId: "",
        supplierId: "",
        accountId: "",
        amount: "",
        paymentMethod: "pos",
        referenceNumber: "",
        notes: "",
      });
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(inv: any) {
    const def = accounts.find((a: any) => a.isDefault) || accounts[0];
    if (!def) {
      setError("هیچ حساب دریافت فعالی در سیستم تعریف نشده است.");
      return;
    }
    if (!confirm(`فاکتور ${inv.invoiceNumber} به مبلغ ${formatMoney(inv.balanceDue)} از طریق حساب «${def.name}» تسویه شود؟`))
      return;
    setBusy(true);
    setError("");
    try {
      const x = await retryableRequest("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: def.id,
          amount: Number(inv.balanceDue),
          customerId: inv.customerId,
          invoiceId: inv.id,
          projectId: inv.projectId,
          paymentType: "customer_receipt",
          paymentMethod: "pos",
          notes: `تسویه فاکتور ${inv.invoiceNumber}`,
        }),
      }).then((r) => r.json());
      if (!x.success) throw Error(x.error);
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/employee-logout", { method: "POST" });
    router.push("/employee-login");
  }

  const filteredCustomers = customers.filter(
    (c) =>
      !searchFilter ||
      c.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.storeName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.mobile?.includes(searchFilter)
  );

  const filteredInvoices = invoices.filter(
    (i) =>
      !searchFilter ||
      i.invoiceNumber?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      i.customerName?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (loading && !me) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
        <div className="flex items-center gap-3">
          <RefreshCcw className="h-6 w-6 animate-spin text-cyan-400" />
          <span>در حال دریافت اطلاعات پنل کاربری...</span>
        </div>
      </main>
    );
  }

  if (!me) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6 dir-rtl font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6 md:pr-60">
        {/* Header with Role Badge */}
        <header className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isAccountant
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
              }`}
            >
              {isAccountant ? <Calculator className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{isAccountant ? "داشبورد اختصاصی حسابداری و مالی" : "داشبورد اختصاصی ویزیتور و فروش میدانی"}</span>
                <span className="text-sm font-normal text-slate-400">({me.name})</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                کد پرسنلی: <span className="font-mono text-cyan-300 font-bold">{me.code}</span> · نقش:{" "}
                <span className="text-purple-300 font-bold">
                  {roleCode === "accountant" ? "حسابدار" : roleCode === "admin" ? "مدیر کل" : "ویزیتور فروش"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300" aria-label="باز کردن منو">
              <Menu className="h-5 w-5" />
            </button>
            {(can("*") || can("employees.manage")) && (
              <button
                onClick={() => router.push("/")}
                className="rounded-xl border border-purple-500/40 bg-purple-950/40 px-3.5 py-2 text-xs flex items-center gap-1.5 text-purple-300 hover:bg-purple-900/50 transition font-bold"
              >
                <ShieldCheck className="h-4 w-4" />
                پنل مدیریت کل
              </button>
            )}
            <button
              onClick={loadAll}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              به‌روزرسانی
            </button>
            <button
              onClick={logout}
              className="rounded-xl border border-slate-800 bg-rose-950/30 px-3.5 py-2 text-xs flex items-center gap-1.5 text-rose-300 hover:bg-rose-900/50 transition font-bold"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-200 p-4 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/70 md:hidden" aria-hidden="true" />}
        <nav
          onClick={(event) => { if ((event.target as HTMLElement).closest("button")) setSidebarOpen(false); }}
          className={`${sidebarOpen ? "flex" : "hidden"} fixed inset-y-0 right-0 z-50 w-72 flex-col gap-2 overflow-y-auto border-l border-slate-800 bg-slate-950 p-4 shadow-2xl md:inset-y-4 md:right-4 md:flex md:w-56 md:rounded-3xl md:border`}
        >
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-sm font-bold text-white">منوی همکار</span>
            <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 md:hidden" aria-label="بستن منو"><X className="h-4 w-4" /></button>
          </div>
          <button
            onClick={() => setTab("overview")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "overview"
                ? isAccountant
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white"
            }`}
          >
            داشبورد کلی
          </button>

          {can("customers.view") && <button
            onClick={() => setTab("customers")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "customers"
                ? isAccountant
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white"
            }`}
          >
            مدیریت مشتریان ({customers.length})
          </button>}

          {can("invoices.view") && <button
            onClick={() => setTab("invoices")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "invoices"
                ? isAccountant
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white"
            }`}
          >
            فاکتورهای فروش ({invoices.length})
          </button>}

          {can("payments.view") && (
            <button
              onClick={() => setTab("payments")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                tab === "payments"
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white"
              }`}
            >
              دریافت‌ها و پرداخت‌ها ({payments.length})
            </button>
          )}

          {can("products.view") && <button
            onClick={() => setTab("catalog")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "catalog"
                ? isAccountant
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white"
            }`}
          >
            کاتالوگ محصولات ({products.length})
          </button>}

          <div className="mt-auto flex flex-col gap-2 border-t border-slate-800 pt-3">
            {can("customers.create") && <button
              onClick={() => openCustomerModal()}
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1.5 hover:bg-emerald-500 transition shadow"
            >
              <Plus className="h-4 w-4" />
              + افزودن مشتری
            </button>}
            {can("invoices.create") && <button
              onClick={() => setShowInvoice(true)}
              className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1.5 hover:bg-purple-500 transition shadow"
            >
              <FilePlus2 className="h-4 w-4" />
              + صدور فاکتور
            </button>}
            {can("payments.create") && (
              <button
                onClick={() => setShowPayment(true)}
                className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1.5 hover:bg-blue-500 transition shadow"
              >
                <DollarSign className="h-4 w-4" />
                + ثبت سند مالی
              </button>
            )}
          </div>
        </nav>

        {/* TAB 1: OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 space-y-2">
                <Receipt className="h-5 w-5 text-cyan-400" />
                <p className="text-xs text-slate-400">فروش ثبت شده امروز</p>
                <b className="text-xl font-bold text-white block">{formatMoney(dash?.todaySales || 0)}</b>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 space-y-2">
                <Wallet className="h-5 w-5 text-emerald-400" />
                <p className="text-xs text-slate-400">فروش کل دوره جاری</p>
                <b className="text-xl font-bold text-white block">{formatMoney(dash?.periodSales || 0)}</b>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 space-y-2">
                <Users className="h-5 w-5 text-purple-400" />
                <p className="text-xs text-slate-400">مشتریان فعال سیستم</p>
                <b className="text-xl font-bold text-white block">{dash?.activeCustomers || customers.length} پرونده</b>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 space-y-2">
                {isAccountant ? (
                  <>
                    <CreditCard className="h-5 w-5 text-amber-400" />
                    <p className="text-xs text-slate-400">مانده حساب‌های بانکی</p>
                    <b className="text-xl font-bold text-amber-300 block">
                      {formatMoney(
                        accounts.reduce((s: number, a: any) => s + (Number(a.currentBalance) || 0), 0)
                      )}
                    </b>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <p className="text-xs text-slate-400">پورسانت در انتظار تسویه</p>
                    <b className="text-xl font-bold text-amber-300 block">{formatMoney(dash?.unpaidCommission || 0)}</b>
                  </>
                )}
              </div>
            </div>

            {/* Recent Invoices Table */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-sm text-white">آخرین فاکتورهای صادرشده</h2>
                {can("invoices.view") && <button
                  onClick={() => setTab("invoices")}
                  className="text-xs text-cyan-400 hover:underline"
                >
                  مشاهده همه
                </button>}
              </div>

              <div className="responsive-table overflow-x-auto">
                <table className="w-full text-xs text-slate-300 text-right">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="p-3">شماره فاکتور</th>
                      <th className="p-3">تاریخ</th>
                      <th className="p-3">نام مشتری</th>
                      <th className="p-3">مبلغ کل</th>
                      <th className="p-3">مانده طلب</th>
                      <th className="p-3">وضعیت پرداخت</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invoices.slice(0, 6).map((x: any) => (
                      <tr key={x.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-cyan-300">{x.invoiceNumber}</td>
                        <td className="p-3 text-slate-400">{toJalaliDate(x.invoiceDate || x.createdAt)}</td>
                        <td className="p-3 font-semibold text-white">{x.customerName}</td>
                        <td className="p-3 font-bold text-emerald-400">{formatMoney(x.grandTotal)}</td>
                        <td className="p-3 font-semibold text-rose-400">{formatMoney(x.balanceDue)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              x.paymentStatus === "paid"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : x.paymentStatus === "partial"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {x.paymentStatus === "paid"
                              ? "تسویه شده"
                              : x.paymentStatus === "partial"
                              ? "پرداخت ناقص"
                              : "تسویه نشده"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-1.5">
                            {can("invoices.update") && <button
                              onClick={() =>
                                setEditInvoice({
                                  ...x,
                                  dueDate: x.dueDate ? String(x.dueDate).slice(0, 10) : "",
                                })
                              }
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
                            >
                              ویرایش
                            </button>}
                            {can("payments.create") && x.paymentStatus !== "paid" && (
                              <button
                                onClick={() => markPaid(x)}
                                disabled={busy}
                                className="rounded-lg bg-emerald-500/20 text-emerald-300 px-2.5 py-1 text-xs hover:bg-emerald-500/30 transition"
                              >
                                تسویه
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!invoices.length && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          هنوز فاکتوری ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOMERS */}
        {tab === "customers" && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">مدیریت مشتریان و CRM</h2>
                <p className="text-xs text-slate-400">
                  ثبت مشخصات مشتریان، تعیین سقف اعتبار، لوکیشن نقشه و اتصال خودکار به نشان
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجوی مشتری یا موبایل..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 py-1.5 pr-8 pl-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                  />
                </div>
                {can("customers.create") && <button
                  onClick={() => openCustomerModal()}
                  className="rounded-xl bg-emerald-500 text-slate-950 px-4 py-2 text-xs font-bold hover:bg-emerald-400 transition flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  + مشتری جدید
                </button>}
              </div>
            </div>

            <div className="responsive-table overflow-x-auto">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-3">نام و مسئول</th>
                    <th className="p-3">شماره تماس</th>
                    <th className="p-3">فروشگاه / مرکز</th>
                    <th className="p-3">شهر / آدرس</th>
                    <th className="p-3">موقعیت نقشه (نشان)</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCustomers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">{c.name}</td>
                      <td className="p-3 font-mono text-cyan-300">{c.mobile}</td>
                      <td className="p-3 text-slate-300">{c.storeName || "—"}</td>
                      <td className="p-3 text-slate-400">{c.city || "تهران"} - {c.address ? c.address.slice(0, 25) + "..." : "—"}</td>
                      <td className="p-3">
                        {c.latitude && c.longitude ? (
                          <a
                            href={`https://nshn.ir/?lat=${c.latitude}&lng=${c.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[10px]"
                          >
                            <MapPin className="h-3 w-3" />
                            مسیریابی در نشان
                          </a>
                        ) : (
                          <span className="text-slate-500">بدون لوکیشن</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {can("customers.update") && <button
                          onClick={() => openCustomerModal(c)}
                          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-cyan-300 hover:text-white hover:bg-slate-700 transition flex items-center gap-1 mx-auto"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          ویرایش
                        </button>}
                      </td>
                    </tr>
                  ))}
                  {!filteredCustomers.length && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        مشتری با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 3: INVOICES */}
        {tab === "invoices" && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">فاکتورهای فروش و صدور صورتحساب</h2>
                <p className="text-xs text-slate-400">ثبت فاکتورهای جدید، پیگیری وضعیت تسویه و ویرایش</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجوی شماره فاکتور یا مشتری..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 py-1.5 pr-8 pl-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none"
                  />
                </div>
                {can("invoices.create") && <button
                  onClick={() => setShowInvoice(true)}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold hover:bg-purple-500 transition flex items-center gap-1.5 shrink-0"
                >
                  <FilePlus2 className="h-4 w-4" />
                  + صدور فاکتور جدید
                </button>}
              </div>
            </div>

            <div className="responsive-table overflow-x-auto">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-3">شماره فاکتور</th>
                    <th className="p-3">تاریخ صدور</th>
                    <th className="p-3">نام مشتری</th>
                    <th className="p-3">مبلغ کل فاکتور</th>
                    <th className="p-3">مانده طلب</th>
                    <th className="p-3">وضعیت تسویه</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-cyan-300">{inv.invoiceNumber}</td>
                      <td className="p-3 text-slate-400">{toJalaliDate(inv.invoiceDate || inv.createdAt)}</td>
                      <td className="p-3 font-semibold text-white">{inv.customerName}</td>
                      <td className="p-3 font-bold text-emerald-400">{formatMoney(inv.grandTotal)}</td>
                      <td className="p-3 font-semibold text-rose-400">{formatMoney(inv.balanceDue)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            inv.paymentStatus === "paid"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : inv.paymentStatus === "partial"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {inv.paymentStatus === "paid"
                            ? "تسویه کامل"
                            : inv.paymentStatus === "partial"
                            ? "پرداخت جزیی"
                            : "تسویه نشده"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          {can("invoices.update") && <button
                            onClick={() =>
                              setEditInvoice({
                                ...inv,
                                dueDate: inv.dueDate ? String(inv.dueDate).slice(0, 10) : "",
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
                          >
                            ویرایش
                          </button>}
                          {can("payments.create") && inv.paymentStatus !== "paid" && (
                            <button
                              onClick={() => markPaid(inv)}
                              disabled={busy}
                              className="rounded-xl bg-emerald-500/20 text-emerald-300 px-2.5 py-1 text-xs hover:bg-emerald-500/30 transition"
                            >
                              تسویه شد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredInvoices.length && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        فاکتوری یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 4: PAYMENTS (Accountant only) */}
        {tab === "payments" && can("payments.view") && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white">دفتر دریافت‌ها، پرداخت‌ها و خزانه‌داری</h2>
                <p className="text-xs text-slate-400">ثبت وجوه دریافتی از مشتریان و پرداختی به تامین‌کنندگان و هزینه‌ها</p>
              </div>
              {can("payments.create") && <button
                onClick={() => setShowPayment(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold hover:bg-blue-500 transition flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                + ثبت سند مالی جدید
              </button>}
            </div>

            <div className="responsive-table overflow-x-auto">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-3">نوع سند</th>
                    <th className="p-3">مبلغ</th>
                    <th className="p-3">حساب بانکی / صندوق</th>
                    <th className="p-3">روش پرداخت</th>
                    <th className="p-3">شماره پیگیری</th>
                    <th className="p-3">تاریخ</th>
                    <th className="p-3">توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            p.paymentType === "customer_receipt"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {p.paymentType === "customer_receipt" ? "دریافت از مشتری" : "پرداخت / هزینه"}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-white">{formatMoney(p.amount)}</td>
                      <td className="p-3 text-cyan-300">{p.accountName || "حساب پیش‌فرض"}</td>
                      <td className="p-3 text-slate-400">{p.paymentMethod || "پوز / کارتخوان"}</td>
                      <td className="p-3 font-mono text-slate-400">{p.referenceNumber || "—"}</td>
                      <td className="p-3 text-slate-400">{toJalaliDate(p.createdAt)}</td>
                      <td className="p-3 text-slate-300">{p.notes || "—"}</td>
                    </tr>
                  ))}
                  {!payments.length && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        هنوز تراکنش مالی ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 5: CATALOG */}
        {tab === "catalog" && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">کاتالوگ و لیست قیمت محصولات حکمت آکما</h2>
              <p className="text-xs text-slate-400">بررسی قیمت پایه، واحد و موجودی انبار محصولات</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p: any) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-[10px] text-slate-500">{p.code}</span>
                      <h3 className="font-bold text-white text-sm mt-0.5">{p.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">دسته‌بندی: {p.category || "عمومی"}</p>
                    </div>
                    <span className="text-emerald-400 font-bold text-sm font-mono">
                      {formatMoney(p.basePrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                    <span>واحد: {p.unit || "عدد"}</span>
                    <span>موجودی: <b className="text-cyan-300">{p.stockQuantity ?? "نامحدود"}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* MODAL: ADD/EDIT CUSTOMER */}
      {showCustomer && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto"
        >
          <form
            onSubmit={saveCustomer}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 shadow-2xl my-8 text-xs"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                {editingCustomer ? `ویرایش پرونده مشتری (${editingCustomer.name})` : "افزودن پرونده مشتری جدید"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomer(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام و مسئول فروشگاه <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="مثال: مهدی رحمانی"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">نام فروشگاه / داروخانه:</label>
                <input
                  placeholder="مثال: داروخانه دکتر رحمانی"
                  value={customerForm.storeName}
                  onChange={(e) => setCustomerForm({ ...customerForm, storeName: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  شماره موبایل <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="0912..."
                  value={customerForm.mobile}
                  onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">تلفن ثابت:</label>
                <input
                  placeholder="021..."
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">شهر:</label>
                <input
                  placeholder="تهران"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">پروژه مرتبط:</label>
                <select
                  value={customerForm.projectId}
                  onChange={(e) => setCustomerForm({ ...customerForm, projectId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                >
                  <option value="">-- بدون پروژه (عمومی) --</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">آدرس فروشگاه:</label>
              <input
                placeholder="آدرس دقیق فروشگاه..."
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
              />
            </div>

            {/* Neshan Map Picker */}
            <NeshanMapPicker
              latitude={customerForm.latitude}
              longitude={customerForm.longitude}
              onChange={({ latitude, longitude, address, city }) =>
                setCustomerForm((prev: any) => ({
                  ...prev,
                  latitude,
                  longitude,
                  address: prev.address?.trim() ? prev.address : (address || prev.address),
                  city: prev.city?.trim() ? prev.city : (city || prev.city),
                }))
              }
            />

            <div>
              <label className="block text-slate-300 font-semibold mb-1">توضیحات و یادداشت پیگیری:</label>
              <textarea
                rows={2}
                value={customerForm.notes}
                onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                placeholder="یادداشت‌های مشتری..."
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCustomer(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-emerald-500 text-slate-950 px-6 py-2 font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition"
              >
                {busy ? "در حال ذخیره..." : "ذخیره پرونده مشتری"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NEW INVOICE */}
      {showInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 bg-black/80 overflow-y-auto p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={saveInvoice}
            className="max-w-3xl mx-auto rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 my-8 shadow-2xl text-xs"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FilePlus2 className="h-5 w-5 text-purple-400" />
                صدور فاکتور جدید فروش
              </h3>
              <button
                type="button"
                onClick={() => setShowInvoice(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  انتخاب مشتری <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={invoiceForm.customerId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                >
                  <option value="">-- انتخاب مشتری --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.storeName || c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">پروژه مرتبط:</label>
                <select
                  value={invoiceForm.projectId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, projectId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                >
                  <option value="">فروش بدون پروژه (عمومی)</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-300">ردیف‌های کالای فاکتور</span>
                <button
                  type="button"
                  onClick={() =>
                    setInvoiceForm((f: any) => ({
                      ...f,
                      items: [...f.items, { productId: "", quantity: 1, unitPrice: "" }],
                    }))
                  }
                  className="text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  + افزودن ردیف کالا
                </button>
              </div>

              {invoiceForm.items.map((it: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800"
                >
                  <select
                    required
                    value={it.productId}
                    onChange={(e) => selectProduct(i, e.target.value)}
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-2 text-white"
                  >
                    <option value="">-- انتخاب محصول --</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatMoney(p.basePrice)})
                      </option>
                    ))}
                  </select>

                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      placeholder="تعداد"
                      value={it.quantity}
                      onChange={(e) => updateItem(i, "quantity", e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-white text-center font-bold"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      placeholder="قیمت واحد"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-emerald-400 font-bold"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceForm((f: any) => ({
                        ...f,
                        items: f.items.length === 1 ? f.items : f.items.filter((_: any, j: number) => j !== i),
                      }))
                    }
                    className="text-rose-400 p-1.5 hover:text-rose-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Payment & Account */}
            <div className="grid sm:grid-cols-2 gap-3 border-t border-slate-800 pt-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">مبلغ پرداختی اولیه (تومان):</label>
                <input
                  value={invoiceForm.initialPaymentAmount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, initialPaymentAmount: e.target.value })}
                  type="number"
                  min="0"
                  placeholder="مبلغ دریافتی نقد/پوز..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">حساب واریزی:</label>
                <select
                  value={invoiceForm.accountId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, accountId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                >
                  <option value="">-- انتخاب حساب --</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">توضیحات فاکتور:</label>
              <textarea
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                placeholder="توضیحات فاکتور..."
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
              />
            </div>

            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 flex justify-between items-center text-sm font-bold">
              <span>مبلغ کل فاکتور:</span>
              <span className="text-purple-300 text-base">{formatMoney(total)}</span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowInvoice(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-purple-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition"
              >
                {busy ? "در حال ثبت..." : "تأیید و صدور نهایی فاکتور"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT INVOICE */}
      {editInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={updateInvoice}
            className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">ویرایش فاکتور {editInvoice.invoiceNumber}</h3>
              <button
                type="button"
                onClick={() => setEditInvoice(null)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">وضعیت تسویه پرداخت:</label>
              <select
                value={editInvoice.paymentStatus}
                onChange={(e) => setEditInvoice({ ...editInvoice, paymentStatus: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-bold"
              >
                <option value="unpaid">تسویه نشده (بدهکار)</option>
                <option value="partial">پرداخت ناقص</option>
                <option value="paid">تسویه کامل (پرداخت شد)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">سررسید فاکتور:</label>
              <input
                type="date"
                value={editInvoice.dueDate || ""}
                onChange={(e) => setEditInvoice({ ...editInvoice, dueDate: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">یادداشت‌ها و توضیحات:</label>
              <textarea
                value={editInvoice.notes || ""}
                onChange={(e) => setEditInvoice({ ...editInvoice, notes: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-3 text-white min-h-24"
                placeholder="توضیحات فاکتور..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditInvoice(null)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-purple-600 px-6 py-2 font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500"
              >
                {busy ? "در حال ذخیره..." : "ذخیره تغییرات فاکتور"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NEW PAYMENT (Accountant) */}
      {showPayment && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={savePayment}
            className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-400" />
                ثبت دریافت / پرداخت و سند مالی
              </h3>
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">نوع تراکنش:</label>
              <select
                value={paymentForm.paymentType}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-bold"
              >
                <option value="customer_receipt">دریافت وجه از مشتری</option>
                <option value="supplier_payment">پرداخت به تامین‌کننده</option>
                <option value="expense">هزینه‌های عمومی و جاری</option>
              </select>
            </div>

            {paymentForm.paymentType === "customer_receipt" && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">مشتری مربوطه:</label>
                <select
                  value={paymentForm.customerId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                >
                  <option value="">-- انتخاب مشتری --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.storeName || c.mobile})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  مبلغ (تومان) <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="مبلغ به تومان..."
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  حساب بانکی / صندوق <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={paymentForm.accountId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
                >
                  <option value="">-- انتخاب حساب --</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">شماره پیگیری / ارجاع:</label>
              <input
                placeholder="شماره پیگیری فیش بانکی..."
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">توضیحات و بابت سند:</label>
              <textarea
                rows={2}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="توضیحات سند..."
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-blue-600 px-6 py-2 font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
              >
                {busy ? "در حال ثبت..." : "ثبت نهایی سند"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
