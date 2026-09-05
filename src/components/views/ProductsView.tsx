"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  ShoppingBag,
  Plus,
  Edit2,
  Layers,
  DollarSign,
  Folder,
  RefreshCw,
  Search,
  CheckCircle,
  X,
  AlertTriangle,
  Sliders,
  Trash2,
} from "lucide-react";
import { formatMoney, formatNumber, formatQuantity, toJalaliDate } from "@/lib/dateUtils";

const UNIT_OPTIONS = ["عدد", "لیتر", "کیلوگرم", "گرم", "متر", "بسته", "کارتن", "قوطی", "بطری", "متر مربع", "دستگاه", "طاقه", "رول"];

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"standard" | "special">("standard");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [managingProjectPrice, setManagingProjectPrice] = useState<any | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [customProjectPrice, setCustomPrice] = useState(0);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "پنجره",
    unit: "عدد",
    basePrice: 0,
    stockQuantity: 0,
    minStockQuantity: 5,
    isSpecial: false,
    recipes: [] as { rawMaterialId: string; quantityRequired: number; wastagePercent: number }[],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, projRes, rmRes] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/raw-materials").then((r) => r.json()),
      ]);

      if (!prodRes.success) throw new Error(prodRes.error || "خطا در دریافت محصولات");
      setProducts(prodRes.products || []);
      if (projRes.success) setProjects(projRes.projects || []);
      if (rmRes.success) setRawMaterials(rmRes.rawMaterials || []);
    } catch (err) {
      console.error("Error fetching products:", err);
      alert(err instanceof Error ? err.message : "خطا در دریافت محصولات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setFormData({
      code: "",
      name: "",
      category: activeTab === "special" ? "اختصاصی" : "عمومی",
      unit: "عدد",
      basePrice: 0,
      stockQuantity: 0,
      minStockQuantity: 5,
      isSpecial: activeTab === "special",
      recipes: [],
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteProduct = async (p: any) => {
    if (deletingId) return;
    if (!window.confirm(`محصول دارای سابقه بایگانی می‌شود و سوابق آن حفظ می‌شود. آیا از حذف محصول «${p.name}» با کد «${p.code}» مطمئن هستید؟`)) {
      return;
    }
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" }).then((r) => r.json());
      if (res.success) {
        alert(res.message || "عملیات انجام شد.");
        await fetchData();
      } else {
        alert(res.error || "خطا در حذف محصول");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط با سرور");
    } finally { setDeletingId(null); }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.basePrice <= 0) {
      alert("نام و قیمت پایه محصول الزامی است.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      }).then((r) => r.json());

      if (res.success) {
        setIsAddModalOpen(false);
        fetchData();
      } else {
        alert(res.error || "خطا در ثبت محصول");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_stock",
          productId: adjustingProduct.id,
          newQuantity: adjustQty,
          reason: adjustReason || "تعدیل دستی موجودی محصول",
        }),
      }).then((r) => r.json());

      if (res.success) {
        setAdjustingProduct(null);
        fetchData();
      } else {
        alert(res.error || "خطا در تعدیل موجودی محصول");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  /**
   * PROMPT FIX B: Handle Project Price Update strictly matching (projectId + productId)
   */
  const handleSaveProjectPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingProjectPrice || !selectedProjectId || customProjectPrice <= 0) {
      alert("پروژه و قیمت جدید اختصاصی الزامی است.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_project_price",
          projectId: selectedProjectId,
          productId: managingProjectPrice.id,
          customPrice: customProjectPrice,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setManagingProjectPrice(null);
        fetchData();
        alert("قیمت اختصاصی برای این پروژه با موفقیت ثبت گردید.");
      } else {
        alert(res.error || "خطا در بروزرسانی قیمت پروژه");
      }
    } catch (err: any) {
      alert(err.message || "خطا در سیستم");
    } finally {
      setSaving(false);
    }
  };

  const addRecipeRow = () => {
    if (rawMaterials.length === 0) return;
    setFormData({
      ...formData,
      recipes: [
        ...formData.recipes,
        { rawMaterialId: rawMaterials[0].id, quantityRequired: 1, wastagePercent: 0 },
      ],
    });
  };

  const removeRecipeRow = (index: number) => {
    const updated = [...formData.recipes];
    updated.splice(index, 1);
    setFormData({ ...formData, recipes: updated });
  };

  const openEditProduct = async (product: any) => {
    try {
    const res = await fetch(`/api/products/${product.id}`).then((r) => r.json());
    if (!res.success) return alert(res.error || "خطا در دریافت محصول");
    setEditingProduct(res.product);
    setFormData({
      code: res.product.code,
      name: res.product.name,
      category: res.product.category,
      unit: res.product.unit,
      basePrice: Number(res.product.basePrice),
      stockQuantity: Number(res.product.stockQuantity || 0),
      minStockQuantity: Number(res.product.minStockQuantity || 5),
      isSpecial: !!res.product.isSpecial,
      recipes: (res.recipes || []).map((r: any) => ({
        rawMaterialId: r.rawMaterialId,
        quantityRequired: Number(r.quantityRequired),
        wastagePercent: Number(r.wastagePercent || 0),
      })),
    });
    } catch { alert("خطا در دریافت محصول؛ دوباره تلاش کنید."); }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      }).then((r) => r.json());
      if (res.success) {
        setEditingProduct(null);
        fetchData();
      } else alert(res.error || "خطا در ویرایش محصول");
    } catch (err: any) {
      alert(err.message || "خطا");
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      (activeTab === "special" ? !!p.isSpecial : !p.isSpecial) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-400" />
            کاتالوگ محصولات و فرمول ساخت (BOM)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تعریف قیمت پایه، محاسبه خودکار COGS از روی مواد اولیه، و قیمت‌گذاری تفکیک شده اختصاصی پروژه‌ها
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          افزودن محصول جدید
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("standard")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "standard"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          محصولات عمومی و استاندارد
        </button>
        <button
          onClick={() => setActiveTab("special")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "special"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          محصولات اختصاصی پروژه
        </button>
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام، کد یا دسته‌بندی محصول..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-9 pl-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((p) => {
          const margin = p.basePrice > 0 ? Math.round(((p.basePrice - p.calculatedCost) / p.basePrice) * 100) : 0;
          return (
            <div
              key={p.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl transition-all hover:border-emerald-500/40 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {p.code}
                    </span>
                    {p.isSpecial && (
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                        محصول اختصاصی
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{p.name}</h3>
                  <p className="text-xs text-slate-400">دسته: {p.category}</p>
                </div>
                <NeonBadge variant={Number(p.stockQuantity) > Number(p.minStockQuantity) ? "green" : "yellow"}>
                  موجودی: {formatQuantity(p.stockQuantity, p.unit)}
                </NeonBadge>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>قیمت پایه فروش:</span>
                  <span className="font-bold text-emerald-400 font-mono">{formatMoney(p.basePrice)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>بهای تمام شده (BOM):</span>
                  <span className="font-semibold text-slate-300 font-mono">{formatMoney(p.calculatedCost)}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                  <span>حاشیه سود درصد:</span>
                  <span className={`font-bold font-mono ${margin >= 20 ? "text-emerald-400" : "text-amber-400"}`}>{margin}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 gap-1.5 flex-wrap">
                <button
                  onClick={() => openEditProduct(p)}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-600/15 border border-cyan-500/30 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-600/25 transition-all cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  ویرایش و BOM
                </button>
                <button
                  onClick={() => {
                    setAdjustingProduct(p);
                    setAdjustQty(p.stockQuantity);
                    setAdjustReason("");
                  }}
                  title="تعدیل دستی موجودی"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600/15 border border-emerald-500/30 px-2 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/25 transition-all cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  تعدیل
                </button>
                <button
                  onClick={() => {
                    setManagingProjectPrice(p);
                    setSelectedProjectId(projects[0]?.id || "");
                    setCustomPrice(p.basePrice);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 px-2 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition-all cursor-pointer"
                >
                  <Folder className="h-3.5 w-3.5" />
                  قیمت پروژه
                </button>
                <button
                  onClick={() => handleDeleteProduct(p)}
                  className="p-1.5 rounded-xl bg-rose-950/40 text-rose-400 border border-rose-500/20 hover:bg-rose-900/50 hover:text-rose-200 transition-all cursor-pointer"
                  title="حذف محصول"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-400" />
                تعریف محصول جدید و فرمول ساخت (BOM)
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">کد محصول (خالی = صدور خودکار PRD-XXXX)</label>
                  <input
                    type="text"
                    placeholder="صدور خودکار سیستمی"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">نام محصول *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: پنجره دوجداره اختصاصی"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">دسته‌بندی</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">واحد سنجش</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white cursor-pointer"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">قیمت پایه *</label>
                  <MoneyInput
                    value={formData.basePrice}
                    onChange={(val) => setFormData({ ...formData, basePrice: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">موجودی اولیه در انبار (اعشار مجاز)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">حداقل موجودی هشدار</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.minStockQuantity}
                    onChange={(e) => setFormData({ ...formData, minStockQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* BOM Recipe Section */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">فرمول ساخت (BOM - مواد اولیه مورد نیاز)</span>
                  <button
                    type="button"
                    onClick={addRecipeRow}
                    className="text-emerald-400 font-semibold text-[11px] hover:underline"
                  >
                    + افزودن ماده اولیه به فرمول
                  </button>
                </div>

                {formData.recipes.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl bg-slate-950 p-2 border border-slate-800">
                    <select
                      value={r.rawMaterialId}
                      onChange={(e) => {
                        const updated = [...formData.recipes];
                        updated[idx].rawMaterialId = e.target.value;
                        setFormData({ ...formData, recipes: updated });
                      }}
                      className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-white"
                    >
                      {rawMaterials.map((rm) => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} ({rm.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder="مقدار"
                      value={r.quantityRequired}
                      onChange={(e) => {
                        const updated = [...formData.recipes];
                        updated[idx].quantityRequired = Number(e.target.value);
                        setFormData({ ...formData, recipes: updated });
                      }}
                      className="w-20 rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-white text-center"
                    />

                    <button
                      type="button"
                      onClick={() => removeRecipeRow(idx)}
                      className="text-rose-400 p-1 hover:text-rose-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500"
                >
                  {saving ? "در حال ثبت..." : "ذخیره محصول"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProduct && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-400" />
                ویرایش مشخصات، موجودی و فرمول محصول
              </h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">کد محصول *</label>
                  <input
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="کد"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">نام محصول *</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="نام"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">دسته‌بندی</label>
                  <input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="دسته"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">واحد سنجش</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-white cursor-pointer"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">قیمت پایه *</label>
                  <MoneyInput
                    value={formData.basePrice}
                    onChange={(val) => setFormData({ ...formData, basePrice: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">موجودی فعلی در انبار ({formData.unit})</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-white font-mono text-emerald-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">حداقل موجودی هشدار</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.minStockQuantity}
                    onChange={(e) => setFormData({ ...formData, minStockQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-white font-mono text-amber-300"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300">فرمول ساخت (BOM)</span>
                  <button type="button" onClick={addRecipeRow} className="text-emerald-400 font-semibold hover:underline">
                    + افزودن ماده اولیه
                  </button>
                </div>
                {formData.recipes.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center rounded-xl bg-slate-950 p-2 border border-slate-800">
                    <select
                      value={r.rawMaterialId}
                      onChange={(e) => {
                        const x = [...formData.recipes];
                        x[i].rawMaterialId = e.target.value;
                        setFormData({ ...formData, recipes: x });
                      }}
                      className="flex-1 rounded-lg bg-slate-900 border border-slate-800 p-2 text-white"
                    >
                      {rawMaterials.map((rm) => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} ({rm.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="مقدار"
                      value={r.quantityRequired}
                      onChange={(e) => {
                        const x = [...formData.recipes];
                        x[i].quantityRequired = Number(e.target.value);
                        setFormData({ ...formData, recipes: x });
                      }}
                      className="w-20 rounded-lg bg-slate-900 border border-slate-800 p-2 text-white text-center"
                    />
                    <input
                      type="number"
                      placeholder="ضایعات %"
                      value={r.wastagePercent}
                      onChange={(e) => {
                        const x = [...formData.recipes];
                        x[i].wastagePercent = Number(e.target.value);
                        setFormData({ ...formData, recipes: x });
                      }}
                      className="w-20 rounded-lg bg-slate-900 border border-slate-800 p-2 text-white text-center"
                    />
                    <button type="button" onClick={() => removeRecipeRow(i)} className="text-rose-400 p-1 hover:text-rose-300">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500"
                >
                  {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-emerald-400" />
                تعدیل مستقیم موجودی محصول در انبار
              </h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 text-xs space-y-1">
              <p className="text-slate-400">
                نام محصول: <span className="font-bold text-white">{adjustingProduct.name}</span>
              </p>
              <p className="text-slate-400">
                موجودی فعلی در سیستم:{" "}
                <span className="font-bold text-emerald-400 font-mono">
                  {formatQuantity(adjustingProduct.stockQuantity, adjustingProduct.unit)}
                </span>
              </p>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">مقدار جدید موجودی ({adjustingProduct.unit}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white font-mono text-base font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">علت تغییر / توضیحات</label>
                <input
                  type="text"
                  placeholder="مثلاً: انبارگردانی فصلی، برگشت کالا، رفع مغایرت..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500"
                >
                  {saving ? "در حال ثبت..." : "ثبت تغییر موجودی"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Price Override Modal */}
      {managingProjectPrice && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Folder className="h-5 w-5 text-blue-400" />
                تعیین قیمت اختصاصی پروژه
              </h3>
              <button onClick={() => setManagingProjectPrice(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              محصول: <span className="font-bold text-white">{managingProjectPrice.name}</span> | قیمت پایه:{" "}
              <span className="font-bold text-emerald-400">{managingProjectPrice.basePrice.toLocaleString("fa-IR")} تومان</span>
            </p>

            <form onSubmit={handleSaveProjectPrice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">انتخاب پروژه *</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">قیمت اختصاصی برای این پروژه *</label>
                <MoneyInput
                  value={customProjectPrice}
                  onChange={(val) => setCustomPrice(val)}
                  className="w-full text-xs py-2"
                  unit="تومان"
                />
              </div>

              <div className="rounded-xl bg-blue-950/30 border border-blue-500/20 p-3 text-[11px] text-blue-300">
                این قیمت صرفاً برای فاکتورهای مربوط به همین پروژه اعمال خواهد شد و سایر پروژه‌ها را تغییر نمی‌دهد.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setManagingProjectPrice(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
                >
                  {saving ? "در حال ثبت..." : "ثبت قیمت پروژه"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
