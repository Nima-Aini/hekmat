"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  DollarSign,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Wallet,
  X,
  Building,
  Calendar,
  FileText,
  Landmark,
  Edit2,
  Trash2,
  CheckCircle,
  Star,
  Search,
  Filter,
  Check,
  TrendingUp,
  Layers,
} from "lucide-react";
import { toJalaliDate, formatMoney, formatNumber } from "@/lib/dateUtils";
import { MoneyInput } from "@/components/ui/MoneyInput";

interface AccountItem {
  id: string;
  code: string;
  name: string;
  type: string; // bank, cash, pos, other
  accountNumber?: string | null;
  bankName?: string | null;
  balance: number;
  isDefault?: boolean;
  createdAt?: string;
}

export const FinancialView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "accounts" | "payments" | "expenses">("overview");

  // Data states
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Accounts filter & search
  const [accountSearch, setAccountSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");

  // Account Modal State (Add / Edit)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: "",
    code: "",
    type: "bank",
    bankName: "",
    accountNumber: "",
    balance: 0,
    isDefault: false,
  });

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    category: "rent",
    amount: 0,
    accountId: "",
    projectId: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payRes, expRes, cfRes, projRes, accRes] = await Promise.all([
        fetch("/api/payments").then((r) => r.json()),
        fetch("/api/expenses").then((r) => r.json()),
        fetch("/api/reports?type=cashflow").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/accounts").then((r) => r.json()),
      ]);

      if (payRes.success) setPayments(payRes.payments || []);
      if (expRes.success) setExpenses(expRes.expenses || []);
      if (cfRes.success) setCashflow(cfRes.data || null);
      if (projRes.success) setProjects(projRes.projects || []);
      if (accRes.success) {
        setAccounts(accRes.accounts || []);
      } else if (cfRes.data?.accounts) {
        setAccounts(cfRes.data.accounts);
      }
    } catch (err) {
      console.error("Error fetching financial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleSync = () => fetchData();
    window.addEventListener("akma:expenses-updated", handleSync);
    window.addEventListener("akma:accounts-updated", handleSync);
    return () => {
      window.removeEventListener("akma:expenses-updated", handleSync);
      window.removeEventListener("akma:accounts-updated", handleSync);
    };
  }, []);

  // Open Account Modal for Create
  const handleOpenCreateAccount = () => {
    setEditingAccountId(null);
    setAccountForm({
      name: "",
      code: `ACC-${Date.now().toString().slice(-4)}`,
      type: "bank",
      bankName: "بانک ملت",
      accountNumber: "",
      balance: 0,
      isDefault: accounts.length === 0,
    });
    setIsAccountModalOpen(true);
  };

  // Open Account Modal for Edit
  const handleOpenEditAccount = (acc: AccountItem) => {
    setEditingAccountId(acc.id);
    setAccountForm({
      name: acc.name,
      code: acc.code,
      type: acc.type || "bank",
      bankName: acc.bankName || "",
      accountNumber: acc.accountNumber || "",
      balance: Number(acc.balance || 0),
      isDefault: Boolean(acc.isDefault),
    });
    setIsAccountModalOpen(true);
  };

  // Save Account (Create or Update)
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name.trim()) {
      alert("نام حساب یا صندوق الزامی است.");
      return;
    }

    setAccountSaving(true);
    try {
      const isEdit = Boolean(editingAccountId);
      const url = "/api/accounts";
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit ? { ...accountForm, id: editingAccountId } : accountForm;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        setIsAccountModalOpen(false);
        await fetchData();
        alert(res.message || (isEdit ? "حساب با موفقیت ویرایش شد." : "حساب با موفقیت ثبت شد."));
      } else {
        alert(res.error || "خطا در ذخیره اطلاعات حساب");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setAccountSaving(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`آیا از حذف حساب «${name}» اطمینان دارید؟`)) return;

    try {
      const res = await fetch(`/api/accounts?id=${id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        await fetchData();
        alert(res.message || "حساب با موفقیت حذف شد.");
      } else {
        alert(res.error || "امکان حذف حساب وجود ندارد.");
      }
    } catch (err: any) {
      alert(err.message || "خطا در حذف حساب");
    }
  };

  // Set Default Account
  const handleSetDefaultAccount = async (acc: AccountItem) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: acc.id, isDefault: true }),
      }).then((r) => r.json());

      if (res.success) {
        await fetchData();
      } else {
        alert(res.error || "خطا در تنظیم حساب پیش‌فرض");
      }
    } catch (err: any) {
      alert(err.message || "خطا در تنظیم پیش‌فرض");
    }
  };

  // Open Add Expense Modal
  const openAddExpense = () => {
    setEditingExpense(null);
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    setExpenseForm({
      title: "",
      category: "rent",
      amount: 0,
      accountId: defaultAcc?.id || "",
      projectId: "",
      expenseDate: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setIsExpenseModalOpen(true);
  };

  // Open Edit Expense Modal
  const openEditExpense = (exp: any) => {
    setEditingExpense(exp);
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    setExpenseForm({
      title: exp.title || "",
      category: exp.category || "rent",
      amount: Number(exp.amount) || 0,
      accountId: exp.accountId || defaultAcc?.id || "",
      projectId: exp.projectId || "",
      expenseDate: exp.expenseDate ? String(exp.expenseDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: exp.description || exp.notes || "",
    });
    setIsExpenseModalOpen(true);
  };

  // Save Expense (Create or Update)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || expenseForm.amount <= 0) {
      alert("لطفاً عنوان هزینه و مبلغ معتبر را وارد فرمایید.");
      return;
    }

    let accountId = expenseForm.accountId;
    if (!accountId && accounts.length > 0) {
      accountId = accounts[0].id;
    }

    setExpenseSaving(true);
    try {
      const url = editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses";
      const method = editingExpense ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...expenseForm,
          accountId,
          description: expenseForm.notes,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
        await fetchData();
        window.dispatchEvent(new CustomEvent("akma:expenses-updated"));
        window.dispatchEvent(new CustomEvent("akma:accounts-updated"));
        alert(editingExpense ? "سند هزینه با موفقیت ویرایش شد." : (res.message || "هزینه جاری با موفقیت ثبت شد."));
      } else {
        alert(res.error || "خطا در ثبت هزینه");
      }
    } catch (err: any) {
      alert(err.message || "خطا در سیستم");
    } finally {
      setExpenseSaving(false);
    }
  };

  // Delete / Void Expense
  const handleDeleteExpense = async (exp: any) => {
    if (!window.confirm(`آیا از ابطال و حذف سند هزینه «${exp.title}» به مبلغ ${formatMoney(exp.amount)} اطمینان دارید؟\nاین مبلغ به موجودی حساب یا صندوق بازگردانده خواهد شد.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/expenses/${exp.id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        alert(res.message || "سند هزینه با موفقیت ابطال و حذف گردید.");
        await fetchData();
        window.dispatchEvent(new CustomEvent("akma:expenses-updated"));
        window.dispatchEvent(new CustomEvent("akma:accounts-updated"));
      } else {
        alert(res.error || "خطا در ابطال سند هزینه");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    }
  };

  // Filtered accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchesType = accountTypeFilter === "all" || acc.type === accountTypeFilter;
    const matchesSearch =
      acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
      acc.code.toLowerCase().includes(accountSearch.toLowerCase()) ||
      (acc.bankName && acc.bankName.toLowerCase().includes(accountSearch.toLowerCase())) ||
      (acc.accountNumber && acc.accountNumber.includes(accountSearch));
    return matchesType && matchesSearch;
  });

  const totalLiquidity = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalBankBalance = accounts
    .filter((a) => a.type === "bank" || a.type === "pos")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalCashBalance = accounts
    .filter((a) => a.type === "cash")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-400" />
            حسابداری، بانک‌ها، نقدینگی و هزینه‌ها
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت حساب‌های بانکی و صندوق‌ها، رصد جریان وجوه نقد، دریافت‌ها و هزینه‌های جاری
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchData}
            title="بروزرسانی اطلاعات"
            className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
          <button
            onClick={handleOpenCreateAccount}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition"
          >
            <Plus className="h-4 w-4" />
            + افزودن حساب / بانک جدید
          </button>
          <button
            onClick={openAddExpense}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" />
            + ثبت هزینه جاری
          </button>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === "overview"
              ? "bg-slate-800 text-white shadow-sm border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          نمای کلی نقدینگی و جریان وجوه
        </button>
        <button
          onClick={() => setActiveSubTab("accounts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === "accounts"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Landmark className="h-3.5 w-3.5" />
          مدیریت حساب‌ها و بانک‌ها ({accounts.length})
        </button>
        <button
          onClick={() => setActiveSubTab("payments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === "payments"
              ? "bg-slate-800 text-white shadow-sm border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowDownRight className="h-3.5 w-3.5 text-cyan-400" />
          ریز دریافت‌ها و تسویه‌ها ({payments.length})
        </button>
        <button
          onClick={() => setActiveSubTab("expenses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === "expenses"
              ? "bg-slate-800 text-white shadow-sm border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
          هزینه‌های جاری ({expenses.length})
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-emerald-400" />
            کل نقدینگی و موجودی جاری
          </span>
          <p className="text-xl font-black text-emerald-400 font-mono">{formatMoney(totalLiquidity)}</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Landmark className="h-3.5 w-3.5 text-blue-400" />
            موجودی حساب‌های بانکی
          </span>
          <p className="text-xl font-bold text-blue-400 font-mono">{formatMoney(totalBankBalance)}</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5 text-amber-400" />
            موجودی صندوق‌های نقدی
          </span>
          <p className="text-xl font-bold text-amber-400 font-mono">{formatMoney(totalCashBalance)}</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            تعداد حساب‌ها و صندوق‌ها
          </span>
          <p className="text-xl font-bold text-purple-400 font-mono">{accounts.length} حساب</p>
        </div>
      </div>

      {/* TAB: ACCOUNTS MANAGEMENT */}
      {activeSubTab === "accounts" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Controls / Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="جستجو در نام حساب، بانک یا شماره کارت..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">همه نوع‌ها</option>
                <option value="bank">حساب بانکی</option>
                <option value="cash">صندوق نقدی</option>
                <option value="pos">کارتخوان POS</option>
                <option value="other">سایر حساب‌ها</option>
              </select>
            </div>

            <button
              onClick={handleOpenCreateAccount}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition shrink-0"
            >
              <Plus className="h-4 w-4" />
              حساب / بانک جدید
            </button>
          </div>

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((acc) => {
              const isBank = acc.type === "bank";
              const isCash = acc.type === "cash";
              const isPos = acc.type === "pos";

              return (
                <div
                  key={acc.id}
                  className={`rounded-3xl border p-5 shadow-xl space-y-3 transition-all relative ${
                    acc.isDefault
                      ? "border-blue-500/50 bg-slate-900/90 shadow-blue-500/10"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  {/* Top Badges */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`p-2 rounded-xl ${
                          isBank
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : isCash
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        }`}
                      >
                        {isBank ? (
                          <Landmark className="h-4 w-4" />
                        ) : isCash ? (
                          <Wallet className="h-4 w-4" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-mono">{acc.code}</span>
                        <span className="text-[11px] font-semibold text-slate-300">
                          {isBank ? "حساب بانکی" : isCash ? "صندوق نقدی" : isPos ? "پایانه فروش POS" : "حساب معین"}
                        </span>
                      </div>
                    </div>

                    {acc.isDefault ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-lg">
                        <Star className="h-3 w-3 fill-blue-400 text-blue-400" />
                        پیش‌فرض
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefaultAccount(acc)}
                        title="تنظیم به عنوان حساب پیش‌فرض دریافت و پرداخت"
                        className="text-[10px] text-slate-500 hover:text-blue-400 transition"
                      >
                        انتخاب پیش‌فرض
                      </button>
                    )}
                  </div>

                  {/* Account Name */}
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">{acc.name}</h3>
                    {acc.bankName && <p className="text-xs text-slate-400 mt-0.5">{acc.bankName}</p>}
                    {acc.accountNumber && (
                      <p className="text-xs font-mono text-slate-500 mt-1 tracking-wider dir-ltr text-right">
                        {acc.accountNumber}
                      </p>
                    )}
                  </div>

                  {/* Balance Display */}
                  <div className="border-t border-slate-800/80 pt-3 flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-slate-500 block">موجودی فعلی:</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        {formatMoney(acc.balance)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditAccount(acc)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                        title="ویرایش حساب"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id, acc.name)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                        title="حذف حساب"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {!filteredAccounts.length && (
              <div className="col-span-full rounded-3xl border border-dashed border-slate-800 p-8 text-center space-y-3">
                <Landmark className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">حسابی با مشخصات مورد نظر یافت نشد.</p>
                <button
                  onClick={handleOpenCreateAccount}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition"
                >
                  + ایجاد اولین حساب بانکی یا صندوق
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: OVERVIEW & CASHFLOW */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Account Balances Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-2 hover:border-emerald-500/30 transition cursor-pointer"
                onClick={() => setActiveSubTab("accounts")}
              >
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                    {acc.type === "cash" ? "صندوق نقدی" : acc.type === "pos" ? "کارتخوان POS" : "حساب بانکی"}
                  </span>
                  <NeonBadge variant="blue">{acc.code}</NeonBadge>
                </div>
                <h3 className="text-base font-bold text-white">{acc.name}</h3>
                <p className="text-xl font-bold text-emerald-400 font-mono">{formatMoney(acc.balance)}</p>
              </div>
            ))}
          </div>

          {/* Quick lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Payments */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-emerald-400" />
                  دریافت‌های اخیر مشتریان
                </h3>
                <button
                  onClick={() => setActiveSubTab("payments")}
                  className="text-xs text-blue-400 hover:underline"
                >
                  مشاهده همه
                </button>
              </div>

              <div className="space-y-2">
                {payments.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs"
                  >
                    <div>
                      <b className="text-white block">{p.customerName}</b>
                      <span className="text-[10px] text-slate-500">
                        {p.accountName} · {toJalaliDate(p.paymentDate || p.createdAt)}
                      </span>
                    </div>
                    <b className="font-mono text-emerald-400 font-bold">{formatMoney(p.amount)}</b>
                  </div>
                ))}
                {!payments.length && <p className="text-xs text-slate-500 text-center py-4">دریافتی ثبت نشده است.</p>}
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-rose-400" />
                  هزینه‌های جاری اخیر
                </h3>
                <button
                  onClick={() => setActiveSubTab("expenses")}
                  className="text-xs text-rose-400 hover:underline"
                >
                  مشاهده همه
                </button>
              </div>

              <div className="space-y-2">
                {expenses.slice(0, 5).map((exp) => (
                  <div
                    key={exp.id}
                    className="flex justify-between items-center p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs"
                  >
                    <div>
                      <b className="text-white block">{exp.title}</b>
                      <span className="text-[10px] text-slate-500">
                        {exp.category} · {toJalaliDate(exp.expenseDate || exp.createdAt)}
                      </span>
                    </div>
                    <b className="font-mono text-rose-400 font-bold">{formatMoney(exp.amount)}</b>
                  </div>
                ))}
                {!expenses.length && <p className="text-xs text-slate-500 text-center py-4">هزینه‌ای ثبت نشده است.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS LEDGER */}
      {activeSubTab === "payments" && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden p-6 space-y-4 animate-in fade-in">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-emerald-400" />
            دریافت‌ها و تراکنش‌های تسویه مشتریان
          </h3>
          <div className="responsive-table overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">شماره سند</th>
                  <th className="p-3.5">تاریخ ثبت (شمسی)</th>
                  <th className="p-3.5">طرف حساب (مشتری)</th>
                  <th className="p-3.5">حساب / صندوق مقصد</th>
                  <th className="p-3.5">مبلغ واریزی</th>
                  <th className="p-3.5">روش پرداخت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono font-bold text-cyan-300">{p.paymentNumber}</td>
                    <td className="p-3.5 text-slate-300">{toJalaliDate(p.paymentDate || p.createdAt, { showTime: true })}</td>
                    <td className="p-3.5 font-semibold text-white">{p.customerName}</td>
                    <td className="p-3.5 text-slate-400">{p.accountName}</td>
                    <td className="p-3.5 font-bold text-emerald-400 font-mono">{formatMoney(p.amount)}</td>
                    <td className="p-3.5 text-slate-300">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px]">
                        {p.paymentMethod === "pos"
                          ? "کارتخوان (POS)"
                          : p.paymentMethod === "cash"
                          ? "نقدی"
                          : p.paymentMethod === "card_transfer"
                          ? "کارت به کارت"
                          : p.paymentMethod === "bank_transfer"
                          ? "انتقال بانکی"
                          : p.paymentMethod || "سایر"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!payments.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      هنوز دریافتی ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: EXPENSES */}
      {activeSubTab === "expenses" && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden p-6 space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-rose-400" />
              هزینه‌های جاری ثبت‌شده (قبوض، اجاره، حقوق، ایاب‌وذهاب و ...)
            </h3>
            <button
              onClick={openAddExpense}
              className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
            >
              + ثبت هزینه جدید
            </button>
          </div>
          <div className="responsive-table overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">عنوان هزینه</th>
                  <th className="p-3.5">دسته‌بندی</th>
                  <th className="p-3.5">تاریخ (شمسی)</th>
                  <th className="p-3.5">پرداخت از حساب</th>
                  <th className="p-3.5">مبلغ هزینه</th>
                  <th className="p-3.5">پروژه</th>
                  <th className="p-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-semibold text-white">{exp.title}</td>
                    <td className="p-3.5 text-slate-400">{exp.category}</td>
                    <td className="p-3.5 text-slate-300">{toJalaliDate(exp.expenseDate || exp.createdAt)}</td>
                    <td className="p-3.5 text-slate-400">{exp.accountName || "صندوق اصلی"}</td>
                    <td className="p-3.5 font-bold text-rose-400 font-mono">{formatMoney(exp.amount)}</td>
                    <td className="p-3.5 text-slate-400">{exp.projectName || "عمومی"}</td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditExpense(exp)}
                          className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 hover:text-white transition"
                          title="ویرایش سند هزینه"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp)}
                          className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-500/20 hover:bg-rose-900/50 hover:text-rose-200 transition"
                          title="ابطال و حذف هزینه"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!expenses.length && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      هزینه‌ای ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ACCOUNT */}
      {isAccountModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAccountModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Landmark className="h-5 w-5 text-blue-400" />
                {editingAccountId ? "ویرایش حساب بانکی / صندوق" : "افزودن حساب یا بانک جدید"}
              </h3>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام حساب یا صندوق <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="مثال: حساب جاری بانک ملت، صندوق نقدی فروشگاه، پوز سپه"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    کد حساب <span className="text-rose-400">*</span>
                  </label>
                  <input
                    required
                    placeholder="ACC-101"
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-cyan-300 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نوع حساب:</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="bank">حساب بانکی (جاری / پس‌انداز)</option>
                    <option value="cash">صندوق نقدی ریالی</option>
                    <option value="pos">پایانه کارتخوان (POS)</option>
                    <option value="other">کیف پول / سایر</option>
                  </select>
                </div>
              </div>

              {accountForm.type !== "cash" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">نام بانک / شعبه:</label>
                    <input
                      placeholder="بانک ملت، ملی، پاسارگاد..."
                      value={accountForm.bankName}
                      onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">شماره حساب / شبا / کارت:</label>
                    <input
                      placeholder="شماره حساب یا کارت"
                      value={accountForm.accountNumber}
                      onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white font-mono dir-ltr text-right focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  موجودی فعلی / اولیه <span className="text-rose-400">*</span>
                </label>
                <MoneyInput
                  value={accountForm.balance}
                  onChange={(val) => setAccountForm({ ...accountForm, balance: val })}
                  className="w-full text-xs py-2"
                  unit="تومان"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultAccount"
                  checked={accountForm.isDefault}
                  onChange={(e) => setAccountForm({ ...accountForm, isDefault: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isDefaultAccount" className="text-slate-300 font-semibold cursor-pointer">
                  تنظیم به عنوان حساب پیش‌فرض سیستم برای دریافت‌ها و پرداخت‌ها
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={accountSaving}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition"
                >
                  {accountSaving ? "در حال ثبت..." : editingAccountId ? "ذخیره تغییرات" : "ایجاد و ثبت حساب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD EXPENSE */}
      {isExpenseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsExpenseModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                {editingExpense ? `ویرایش سند هزینه: ${editingExpense.title}` : "ثبت سند هزینه جدید"}
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  شرح و عنوان هزینه <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  placeholder="مثال: هزینه بسته‌بندی، اجاره دفتر، قبوض، ایاب‌وذهاب"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    مبلغ هزینه <span className="text-rose-400">*</span>
                  </label>
                  <MoneyInput
                    value={expenseForm.amount}
                    onChange={(val) => setExpenseForm({ ...expenseForm, amount: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">دسته‌بندی هزینه:</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  >
                    <option value="rent">اجاره و رهن</option>
                    <option value="utilities">قبوض (آب، برق، گاز، اینترنت)</option>
                    <option value="salary">حقوق و دستمزد</option>
                    <option value="transport">حمل و نقل و ایاب ذهاب</option>
                    <option value="packaging">ملزومات و بسته‌بندی</option>
                    <option value="marketing">تبلیغات و بازاریابی</option>
                    <option value="other">سایر هزینه‌های جاری</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    پرداخت از حساب / صندوق <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={expenseForm.accountId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, accountId: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">پروژه مرتبط:</label>
                  <select
                    value={expenseForm.projectId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, projectId: e.target.value })}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  >
                    <option value="">-- بدون پروژه (عمومی) --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و شماره فاکتور یا سند:</label>
                <textarea
                  rows={2}
                  placeholder="توضیحات تکمیلی..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف و بستن
                </button>
                <button
                  type="submit"
                  disabled={expenseSaving}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                >
                  {expenseSaving ? "در حال پردازش..." : editingExpense ? "ذخیره تغییرات هزینه" : "ثبت نهایی هزینه"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
