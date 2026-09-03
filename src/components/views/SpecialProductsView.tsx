"use client";

import React, { useEffect, useState, useMemo } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Trash2,
  Eye,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  Tag,
  ImageIcon,
} from "lucide-react";
import { toJalaliDate, formatMoney, formatNumber, formatQuantity } from "@/lib/dateUtils";
import { MoneyInput } from "@/components/ui/MoneyInput";

interface SpecialProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  imageUrl?: string | null;
  description?: string | null;
  basePrice: number | string;
  stockQuantity: number | string;
  minStockQuantity: number | string;
  status: "active" | "inactive";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

const UNIT_OPTIONS = [
  "عدد",
  "لیتر",
  "کیلوگرم",
  "گرم",
  "متر",
  "بسته",
  "کارتن",
  "قوطی",
  "بطری",
  "متر مربع",
  "دستگاه",
  "طاقه",
  "رول",
];

export const SpecialProductsView: React.FC = () => {
  const [products, setProducts] = useState<SpecialProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SpecialProduct | null>(null);

  // Form State
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "اختصاصی",
    unit: "عدد",
    customUnit: "",
    imageUrl: "",
    description: "",
    basePrice: 0,
    stockQuantity: "0",
    minStockQuantity: "0",
    status: "active" as "active" | "inactive",
    notes: "",
  });

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/special-products").then((r) => r.json());
      if (res.success) {
        setProducts(res.specialProducts || []);
      } else {
        showToast(res.error || "خطا در دریافت لیست محصولات اختصاصی", "error");
      }
    } catch (err: any) {
      console.error("Error fetching special products:", err);
      showToast(err.message || "خطا در برقراری ارتباط با سرور", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()));

      const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
      const matchStatus = statusFilter === "all" || p.status === statusFilter;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  // KPI Calculations
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.status === "active").length;
  const lowStockCount = products.filter(
    (p) => Number(p.stockQuantity) <= Number(p.minStockQuantity) && Number(p.minStockQuantity) > 0
  ).length;
  const totalStockSum = products.reduce((acc, p) => acc + (Number(p.stockQuantity) || 0), 0);

  const openCreateModal = () => {
    setForm({
      name: "",
      category: "اختصاصی",
      unit: "عدد",
      customUnit: "",
      imageUrl: "",
      description: "",
      basePrice: 0,
      stockQuantity: "0",
      minStockQuantity: "0",
      status: "active",
      notes: "",
    });
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (p: SpecialProduct) => {
    setSelectedProduct(p);
    const isCustomUnit = !UNIT_OPTIONS.includes(p.unit);
    setForm({
      name: p.name,
      category: p.category || "اختصاصی",
      unit: isCustomUnit ? "سایر" : p.unit,
      customUnit: isCustomUnit ? p.unit : "",
      imageUrl: p.imageUrl || "",
      description: p.description || "",
      basePrice: Number(p.basePrice) || 0,
      stockQuantity: String(p.stockQuantity ?? 0),
      minStockQuantity: String(p.minStockQuantity ?? 0),
      status: p.status || "active",
      notes: p.notes || "",
    });
    setErrorMessage(null);
    setIsEditModalOpen(true);
  };

  const openDetailsModal = (p: SpecialProduct) => {
    setSelectedProduct(p);
    setIsDetailsModalOpen(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMessage("نام محصول اختصاصی الزامی است.");
      return;
    }

    const finalUnit = form.unit === "سایر" ? form.customUnit.trim() || "واحد" : form.unit;

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/special-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim() || "اختصاصی",
          unit: finalUnit,
          imageUrl: form.imageUrl.trim() || undefined,
          description: form.description.trim() || undefined,
          basePrice: form.basePrice,
          stockQuantity: parseFloat(form.stockQuantity) || 0,
          minStockQuantity: parseFloat(form.minStockQuantity) || 0,
          status: form.status,
          notes: form.notes.trim() || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setIsCreateModalOpen(false);
        await fetchData();
        showToast("محصول اختصاصی جدید با موفقیت ایجاد گردید.", "success");
      } else {
        setErrorMessage(res.error || "خطا در ثبت محصول اختصاصی");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!form.name.trim()) {
      setErrorMessage("نام محصول اختصاصی الزامی است.");
      return;
    }

    const finalUnit = form.unit === "سایر" ? form.customUnit.trim() || "واحد" : form.unit;

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/special-products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim() || "اختصاصی",
          unit: finalUnit,
          imageUrl: form.imageUrl.trim() || undefined,
          description: form.description.trim() || undefined,
          basePrice: form.basePrice,
          stockQuantity: parseFloat(form.stockQuantity) || 0,
          minStockQuantity: parseFloat(form.minStockQuantity) || 0,
          status: form.status,
          notes: form.notes.trim() || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setIsEditModalOpen(false);
        setSelectedProduct(null);
        await fetchData();
        showToast("محصول اختصاصی با موفقیت ویرایش شد.", "success");
      } else {
        setErrorMessage(res.error || "خطا در ویرایش محصول اختصاصی");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: SpecialProduct) => {
    if (
      !window.confirm(
        `آیا از حذف محصول اختصاصی «${p.name}» با کد «${p.code}» اطمینان کامل دارید؟\nتوجه: کد این محصول پس از حذف مجدداً برای هیچ محصول دیگری اختصاص نخواهد یافت.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/special-products/${p.id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        showToast(res.message || "محصول اختصاصی با موفقیت حذف گردید.", "success");
        await fetchData();
      } else {
        showToast(res.error || "خطا در حذف محصول اختصاصی", "error");
      }
    } catch (err: any) {
      showToast(err.message || "خطا در برقراری ارتباط با سرور", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 shadow-2xl transition-all duration-300 text-xs font-semibold backdrop-blur-md ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/40"
              : "bg-rose-950/90 text-rose-300 border border-rose-500/40"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-400" />
            محصولات اختصاصی (Special Products)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت کامل و مستقل کاتالوگ کالاهای سفارشی و محصولات ویژه با شناسه‌های یکتا و پشتیبانی کامل از مقادیر اعشاری (مانند لیتر)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-400 hover:text-white transition"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            + ثبت محصول اختصاصی جدید
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            تعداد کل محصولات اختصاصی
          </span>
          <p className="text-xl font-bold text-white font-mono">{formatNumber(totalCount)} قلم</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            محصولات اختصاصی فعال
          </span>
          <p className="text-xl font-bold text-emerald-400 font-mono">{formatNumber(activeCount)} فعال</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            هشدار کمبود موجودی
          </span>
          <p className="text-xl font-bold text-amber-400 font-mono">{formatNumber(lowStockCount)} محصول</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-cyan-400" />
            مجموع موجودی انبار
          </span>
          <p className="text-xl font-bold text-cyan-400 font-mono">{formatNumber(totalStockSum, 4)}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800 shadow-md">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="جستجو در نام محصول، کد اختصاصی (SPC-XXXX)، توضیحات یا دسته..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>دسته‌بندی:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">همه دسته‌ها</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>وضعیت:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="h-6 w-6 text-purple-400 animate-spin mx-auto" />
            <p className="text-xs">در حال بارگذاری اطلاعات محصولات اختصاصی...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Sparkles className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium">هیچ محصول اختصاصی مطابق با شرایط جستجو یافت نشد.</p>
            <button
              onClick={openCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 text-xs bg-purple-600 px-4 py-2 rounded-xl text-white hover:bg-purple-500 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              افزودن اولین محصول اختصاصی
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">کد اختصاصی</th>
                  <th className="p-4">عنوان و مشخصات کالا</th>
                  <th className="p-4">دسته‌بندی</th>
                  <th className="p-4">واحد شمارش</th>
                  <th className="p-4">موجودی انبار</th>
                  <th className="p-4">حداقل موجودی</th>
                  <th className="p-4">قیمت پایه (تومان)</th>
                  <th className="p-4">تاریخ ثبت (شمسی)</th>
                  <th className="p-4">وضعیت</th>
                  <th className="p-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const isLow =
                    Number(p.stockQuantity) <= Number(p.minStockQuantity) && Number(p.minStockQuantity) > 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      {/* Code */}
                      <td className="p-4">
                        <span className="font-mono font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-800/40">
                          {p.code}
                        </span>
                      </td>

                      {/* Name & Image */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-9 w-9 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-500">
                              <Sparkles className="h-4 w-4 text-purple-400" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-white block">{p.name}</span>
                            {p.description && (
                              <span className="text-[11px] text-slate-400 line-clamp-1 max-w-xs block">
                                {p.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                          {p.category}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="p-4 font-medium text-slate-300">{p.unit}</td>

                      {/* Stock Quantity */}
                      <td className="p-4">
                        <span
                          className={`font-mono font-bold ${
                            isLow ? "text-amber-400 flex items-center gap-1" : "text-emerald-300"
                          }`}
                        >
                          {isLow && <AlertTriangle className="h-3 w-3 inline shrink-0" />}
                          {formatQuantity(p.stockQuantity, p.unit)}
                        </span>
                      </td>

                      {/* Min Stock */}
                      <td className="p-4 font-mono text-slate-400">
                        {formatQuantity(p.minStockQuantity, p.unit)}
                      </td>

                      {/* Base Price */}
                      <td className="p-4 font-mono font-bold text-slate-100">
                        {Number(p.basePrice) > 0 ? formatMoney(p.basePrice) : <span className="text-slate-500 font-normal">—</span>}
                      </td>

                      {/* Date Created in Jalali */}
                      <td className="p-4 font-mono text-slate-400 text-[11px]">
                        {toJalaliDate(p.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <NeonBadge variant={p.status === "active" ? "green" : "gray"}>
                          {p.status === "active" ? "فعال" : "غیرفعال"}
                        </NeonBadge>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openDetailsModal(p)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
                            title="مشاهده جزییات کامل"
                          >
                            <Eye className="h-3.5 w-3.5 text-purple-400" />
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
                            title="ویرایش محصول اختصاصی"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-cyan-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-500/20 hover:bg-rose-900/50 hover:text-rose-200 transition cursor-pointer"
                            title="حذف محصول اختصاصی"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                ثبت محصول اختصاصی جدید
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">
                    نام / عنوان محصول اختصاصی <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مایع فرمولاسیون اختصاصی الف"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">دسته‌بندی</label>
                  <input
                    type="text"
                    placeholder="مثال: اختصاصی، سفارشی، فله"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">واحد شمارش / سنجش</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="سایر">سایر (ورود دستی)</option>
                  </select>
                </div>

                {form.unit === "سایر" && (
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">نام واحد دلخواه</label>
                    <input
                      type="text"
                      placeholder="مثال: گالن، کیسه، بشکه"
                      value={form.customUnit}
                      onChange={(e) => setForm({ ...form, customUnit: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1">موجودی اولیه انبار (اعشاری مجاز)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    پشتیبانی کامل از مقادیر اعشار (مثال: ۲.۵ لیتر)
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">حداقل نقطه سفارش (نقطه هشدار)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={form.minStockQuantity}
                    onChange={(e) => setForm({ ...form, minStockQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">قیمت پایه فروش (در صورت وجود)</label>
                  <MoneyInput
                    value={form.basePrice}
                    onChange={(val) => setForm({ ...form, basePrice: val })}
                    className="w-full text-xs py-2.5"
                    unit="تومان"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">لینک تصویر محصول (اختیاری)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono text-left focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">توضیحات و مشخصات فنی</label>
                  <textarea
                    rows={2}
                    placeholder="توضیحات، خواص شیمیایی، مشخصات بسته‌بندی یا کاربرد محصول اختصاصی..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">وضعیت فعالیت</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white cursor-pointer"
                  >
                    <option value="active">فعال</option>
                    <option value="inactive">غیرفعال</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">یادداشت داخلی</label>
                  <input
                    type="text"
                    placeholder="یادداشت‌های محرمانه مدیریت..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-purple-600 px-5 py-2 font-semibold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "در حال ثبت..." : "ثبت و صدور کد یکتا"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-400" />
                ویرایش محصول اختصاصی «{selectedProduct.name}»
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">کد اختصاصی غیرقابل تغییر:</span>
              <span className="font-mono font-bold text-purple-300">{selectedProduct.code}</span>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">
                    نام / عنوان محصول اختصاصی <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">دسته‌بندی</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">واحد شمارش / سنجش</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="سایر">سایر (ورود دستی)</option>
                  </select>
                </div>

                {form.unit === "سایر" && (
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">نام واحد دلخواه</label>
                    <input
                      type="text"
                      value={form.customUnit}
                      onChange={(e) => setForm({ ...form, customUnit: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1">موجودی انبار (پشتیبانی از اعشار)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">حداقل نقطه سفارش</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.minStockQuantity}
                    onChange={(e) => setForm({ ...form, minStockQuantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">قیمت پایه فروش</label>
                  <MoneyInput
                    value={form.basePrice}
                    onChange={(val) => setForm({ ...form, basePrice: val })}
                    className="w-full text-xs py-2.5"
                    unit="تومان"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">لینک تصویر محصول</label>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono text-left focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">توضیحات و مشخصات</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">وضعیت فعالیت</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white cursor-pointer"
                  >
                    <option value="active">فعال</option>
                    <option value="inactive">غیرفعال</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">یادداشت داخلی</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-purple-600 px-5 py-2 font-semibold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {isDetailsModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                مشخصات کامل محصول اختصاصی
              </h3>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedProduct.imageUrl && (
              <div className="flex justify-center">
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="max-h-48 rounded-xl object-contain border border-slate-800 bg-slate-950 p-1"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">کد یکتای اختصاصی:</span>
                <span className="font-mono font-bold text-purple-300 text-sm mt-0.5 block">
                  {selectedProduct.code}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">وضعیت:</span>
                <div className="mt-1">
                  <NeonBadge variant={selectedProduct.status === "active" ? "green" : "gray"}>
                    {selectedProduct.status === "active" ? "فعال" : "غیرفعال"}
                  </NeonBadge>
                </div>
              </div>

              <div className="col-span-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">نام محصول:</span>
                <span className="font-bold text-white text-sm mt-0.5 block">{selectedProduct.name}</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">دسته‌بندی:</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{selectedProduct.category}</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">واحد سنجش:</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{selectedProduct.unit}</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">موجودی فعلی انبار:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5 block">
                  {formatQuantity(selectedProduct.stockQuantity, selectedProduct.unit)}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">حداقل موجودی (نقطه هشدار):</span>
                <span className="font-mono font-bold text-amber-400 text-sm mt-0.5 block">
                  {formatQuantity(selectedProduct.minStockQuantity, selectedProduct.unit)}
                </span>
              </div>

              <div className="col-span-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">قیمت پایه:</span>
                <span className="font-mono font-bold text-white text-sm mt-0.5 block">
                  {Number(selectedProduct.basePrice) > 0
                    ? formatMoney(selectedProduct.basePrice)
                    : "تعیین نشده"}
                </span>
              </div>

              {selectedProduct.description && (
                <div className="col-span-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">توضیحات و مشخصات:</span>
                  <p className="text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              <div className="col-span-2 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between text-[11px] text-slate-400">
                <span>تاریخ ثبت (شمسی): {toJalaliDate(selectedProduct.createdAt, { showTime: true })}</span>
                <span>آخرین تغییر: {toJalaliDate(selectedProduct.updatedAt, { showTime: true })}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openEditModal(selectedProduct);
                }}
                className="flex items-center gap-1 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" />
                ویرایش محصول
              </button>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
