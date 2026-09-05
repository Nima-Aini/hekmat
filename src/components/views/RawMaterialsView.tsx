"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { parsePersianError } from "@/lib/errorUtils";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { toJalaliDate } from "@/lib/dateUtils";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  History,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle,
  X,
  Sliders,
  AlertCircle,
} from "lucide-react";

export const RawMaterialsView: React.FC = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Modals & Drawers state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMaterial, setEditMaterial] = useState<any | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<any | null>(null);
  const [adjustingMaterial, setAdjustMaterial] = useState<any | null>(null);
  const [viewingHistoryMaterial, setViewingHistory] = useState<any | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form fields for Add/Edit
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    unit: "کیلوگرم",
    unitConversionFactor: 1,
    secondaryUnit: "",
    stockQuantity: 0,
    minStockQuantity: 10,
    currentCost: 0,
    supplierId: "",
    costPolicy: "average",
    notes: "",
    priceChangeReason: "",
  });

  // Adjustment fields
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rmRes, supRes] = await Promise.all([
        fetch("/api/raw-materials").then((r) => r.json()),
        fetch("/api/suppliers").then((r) => r.json()),
      ]);

      if (rmRes.success) setMaterials(rmRes.rawMaterials || []);
      if (supRes.success) setSuppliers(supRes.suppliers || []);
    } catch (err) {
      console.error("Error fetching raw materials:", err);
      showToast("خطا در برقراری ارتباط با سرور", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateNextCode = () => {
    const existingCodes = new Set(materials.map((m) => m.code));
    let num = materials.length + 1;
    while (existingCodes.has(`RM-${String(num).padStart(3, "0")}`)) {
      num++;
    }
    return `RM-${String(num).padStart(3, "0")}`;
  };

  const openAddModal = () => {
    setFormData({
      code: generateNextCode(),
      name: "",
      unit: "کیلوگرم",
      unitConversionFactor: 1,
      secondaryUnit: "",
      stockQuantity: 0,
      minStockQuantity: 10,
      currentCost: 0,
      supplierId: "",
      costPolicy: "average",
      notes: "",
      priceChangeReason: "",
    });
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (rm: any) => {
    setEditMaterial(rm);
    setFormData({
      code: rm.code || "",
      name: rm.name || "",
      unit: rm.unit || "کیلوگرم",
      unitConversionFactor: rm.unitConversionFactor || 1,
      secondaryUnit: rm.secondaryUnit || "",
      stockQuantity: Number(rm.stockQuantity) || 0,
      minStockQuantity: Number(rm.minStockQuantity) || 0,
      currentCost: Number(rm.currentCost) || 0,
      supplierId: rm.supplierId || "",
      costPolicy: rm.costPolicy || "average",
      notes: rm.notes || "",
      priceChangeReason: "",
    });
    setErrorMessage(null);
  };

  const openDeleteModal = (rm: any) => {
    setDeletingMaterial(rm);
    setDeleteErrorMessage(null);
  };

  const openHistoryDrawer = async (rm: any) => {
    setViewingHistory(rm);
    try {
      const res = await fetch(`/api/raw-materials/${rm.id}`).then((r) => r.json());
      if (res.success) {
        setPriceHistory(res.priceHistory || []);
      }
    } catch (err) {
      console.error("Failed to load price history:", err);
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formData.code.trim();
    const cleanName = formData.name.trim();

    if (!cleanCode) {
      setErrorMessage("لطفاً کد ماده اولیه را وارد کنید.");
      return;
    }
    if (!cleanName) {
      setErrorMessage("لطفاً نام ماده اولیه را وارد کنید.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/raw-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          code: cleanCode,
          name: cleanName,
          currentCost: Number(formData.currentCost) || 0,
          stockQuantity: Number(formData.stockQuantity) || 0,
          minStockQuantity: Number(formData.minStockQuantity) || 0,
          unitConversionFactor: Number(formData.unitConversionFactor) || 1,
          supplierId: formData.supplierId.trim() || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setIsAddModalOpen(false);
        showToast(`ماده اولیه "${cleanName}" با موفقیت ثبت شد.`);
        await fetchData();
      } else {
        setErrorMessage(parsePersianError(res.error || "خطا در ثبت ماده اولیه"));
      }
    } catch (err: any) {
      setErrorMessage(parsePersianError(err.message || "خطای ارتباط با سرور"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    const cleanCode = formData.code.trim();
    const cleanName = formData.name.trim();

    if (!cleanCode || !cleanName) {
      setErrorMessage("کد و نام ماده اولیه الزامی هستند.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/raw-materials/${editingMaterial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          code: cleanCode,
          name: cleanName,
          currentCost: Number(formData.currentCost) || 0,
          minStockQuantity: Number(formData.minStockQuantity) || 0,
          unitConversionFactor: Number(formData.unitConversionFactor) || 1,
          supplierId: formData.supplierId.trim() || null,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setEditMaterial(null);
        showToast(`ماده اولیه "${cleanName}" با موفقیت ویرایش گردید.`);
        await fetchData();
      } else {
        setErrorMessage(parsePersianError(res.error || "خطا در به روزرسانی ماده اولیه"));
      }
    } catch (err: any) {
      setErrorMessage(parsePersianError(err.message || "خطای ارتباط با سرور"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMaterial) return;

    setDeleting(true);
    setDeleteErrorMessage(null);
    try {
      const res = await fetch(`/api/raw-materials/${deletingMaterial.id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        showToast(res.message || "ماده اولیه با موفقیت حذف گردید.");
        setDeletingMaterial(null);
        await fetchData();
      } else {
        setDeleteErrorMessage(parsePersianError(res.error || "خطا در حذف ماده اولیه"));
      }
    } catch (err: any) {
      setDeleteErrorMessage(parsePersianError(err.message || "خطای ارتباط با سرور در هنگام حذف"));
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingMaterial) return;

    setSaving(true);
    try {
      const res = await fetch("/api/raw-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_stock",
          rawMaterialId: adjustingMaterial.id,
          newQuantity: adjustQty,
          reason: adjustReason || "تعدیل دستی انبار",
        }),
      }).then((r) => r.json());

      if (res.success) {
        showToast("موجودی ماده اولیه با موفقیت تعدیل گردید.");
        setAdjustMaterial(null);
        await fetchData();
      } else {
        alert(res.error || "خطا در تعدیل موجودی");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const filteredMaterials = materials.filter((rm) => {
    const matchesSearch =
      (rm.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rm.code || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLow = filterLowStock ? rm.isLowStock : true;
    return matchesSearch && matchesLow;
  });

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
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          )}
          {toastMessage.text}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-400" />
            مدیریت کامل مواد اولیه و قطعات
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تعریف مواد اولیه، ثبت قیمت خرید، تاریخچه تغییرات قیمت، کنترل موجودی انبار و حذف امن
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-add-raw-material"
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            افزودن ماده اولیه جدید
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="input-search-raw-materials"
            type="text"
            placeholder="جستجو بر اساس نام یا کد ماده اولیه..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-9 pl-4 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-filter-low-stock"
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
              filterLowStock
                ? "border-amber-500 bg-amber-500/10 text-amber-300"
                : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            فقط مواد اولیه دارای کمبود
          </button>

          <button
            id="btn-refresh-raw-materials"
            onClick={fetchData}
            title="به‌روزرسانی جدول"
            className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table Data */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
        <div className="responsive-table overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">کد</th>
                <th className="p-4">نام ماده اولیه</th>
                <th className="p-4">واحد سنجش</th>
                <th className="p-4">موجودی فعلی</th>
                <th className="p-4">قیمت خرید جاری</th>
                <th className="p-4">میانگین موزون قیمت</th>
                <th className="p-4">تامین‌کننده</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMaterials.length > 0 ? (
                filteredMaterials.map((rm) => (
                  <tr key={rm.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-4 font-mono font-bold text-slate-400">{rm.code}</td>
                    <td className="p-4 font-semibold text-white">
                      {rm.name}
                      {rm.notes && <p className="text-[10px] text-slate-500 font-normal">{rm.notes}</p>}
                    </td>
                    <td className="p-4 text-slate-300">{rm.unit}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${Number(rm.stockQuantity || 0) <= 0 ? "text-rose-400 font-black" : rm.isLowStock ? "text-amber-400" : "text-slate-200"}`}>
                          {Number(rm.stockQuantity || 0).toLocaleString("fa-IR")}
                        </span>
                        {Number(rm.stockQuantity || 0) <= 0 ? (
                          <NeonBadge variant="red" size="sm" pulse>
                            موجودی صفر (اتمام)
                          </NeonBadge>
                        ) : rm.isLowStock ? (
                          <NeonBadge variant="yellow" size="sm" pulse>
                            کمبود موجودی
                          </NeonBadge>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-emerald-400">
                      {Number(rm.currentCost || 0).toLocaleString("fa-IR")}{" "}
                      <span className="text-[10px] text-slate-500">تومان</span>
                    </td>
                    <td className="p-4 font-semibold text-sky-300">
                      {Number(rm.averageCost || 0).toLocaleString("fa-IR")}{" "}
                      <span className="text-[10px] text-slate-500">تومان</span>
                    </td>
                    <td className="p-4 text-slate-400">{rm.supplierName || "نامشخص"}</td>
                    <td className="p-4">
                      <NeonBadge variant={rm.status === "active" ? "green" : "gray"}>
                        {rm.status === "active" ? "فعال" : "غیرفعال"}
                      </NeonBadge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          id={`btn-edit-rm-${rm.id}`}
                          onClick={() => openEditModal(rm)}
                          title="ویرایش ماده اولیه"
                          className="rounded-lg bg-blue-500/10 p-1.5 text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          id={`btn-adjust-rm-${rm.id}`}
                          onClick={() => {
                            setAdjustMaterial(rm);
                            setAdjustQty(Number(rm.stockQuantity) || 0);
                            setAdjustReason("");
                          }}
                          title="تعدیل دستی موجودی"
                          className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </button>
                        <button
                          id={`btn-history-rm-${rm.id}`}
                          onClick={() => openHistoryDrawer(rm)}
                          title="تاریخچه تغییرات قیمت"
                          className="rounded-lg bg-purple-500/10 p-1.5 text-purple-400 hover:bg-purple-500/20 transition-all cursor-pointer"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          id={`btn-delete-rm-${rm.id}`}
                          onClick={() => openDeleteModal(rm)}
                          title="حذف ماده اولیه"
                          className="rounded-lg bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    ماده اولیه متناظر با فیلتر یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-400" />
                تعریف ماده اولیه جدید
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdd} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">کد ماده اولیه *</label>
                  <input
                    id="input-add-rm-code"
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">نام ماده اولیه *</label>
                  <input
                    id="input-add-rm-name"
                    type="text"
                    required
                    placeholder="مثلاً: پروفیل آلومینیوم خام"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">واحد اصلی *</label>
                  <select
                    id="select-add-rm-unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="کیلوگرم">کیلوگرم</option>
                    <option value="مترمربع">مترمربع</option>
                    <option value="مترطول">مترطول</option>
                    <option value="عدد">عدد</option>
                    <option value="بسته">بسته</option>
                    <option value="کارتن">کارتن</option>
                    <option value="شاخه">شاخه</option>
                    <option value="ورق">ورق</option>
                    <option value="لیتر">لیتر</option>
                    <option value="گرم">گرم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">قیمت خرید جاری *</label>
                  <MoneyInput
                    value={formData.currentCost}
                    onChange={(val) => setFormData({ ...formData, currentCost: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">موجودی اولیه</label>
                  <input
                    id="input-add-rm-stock"
                    type="number"
                    step="any"
                    min="0"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">حداقل نقطه سفارش (هشدار کمبود)</label>
                  <input
                    id="input-add-rm-min-stock"
                    type="number"
                    step="any"
                    min="0"
                    value={formData.minStockQuantity}
                    onChange={(e) => setFormData({ ...formData, minStockQuantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">تامین‌کننده پیش‌فرض</label>
                <select
                  id="select-add-rm-supplier"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- بدون تعیین تامین‌کننده --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || s.mobile || ""})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">توضیحات و یادداشت</label>
                <input
                  id="input-add-rm-notes"
                  type="text"
                  placeholder="مشخصات فنی، گرید یا ابعاد..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  id="btn-submit-add-rm"
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "در حال ثبت..." : "ذخیره ماده اولیه"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMaterial && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-400" />
                ویرایش ماده اولیه: {editingMaterial.name}
              </h3>
              <button onClick={() => setEditMaterial(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">کد ماده اولیه *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">نام ماده اولیه *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">قیمت خرید جاری *</label>
                  <MoneyInput
                    value={formData.currentCost}
                    onChange={(val) => setFormData({ ...formData, currentCost: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">علت تغییر قیمت (جهت ثبت در تاریخچه)</label>
                  <input
                    type="text"
                    placeholder="مثلاً: فاکتور خرید جدید یا تورم"
                    value={formData.priceChangeReason}
                    onChange={(e) => setFormData({ ...formData, priceChangeReason: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">واحد اصلی</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="کیلوگرم">کیلوگرم</option>
                    <option value="مترمربع">مترمربع</option>
                    <option value="مترطول">مترطول</option>
                    <option value="عدد">عدد</option>
                    <option value="بسته">بسته</option>
                    <option value="کارتن">کارتن</option>
                    <option value="شاخه">شاخه</option>
                    <option value="ورق">ورق</option>
                    <option value="لیتر">لیتر</option>
                    <option value="گرم">گرم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">حداقل نقطه سفارش</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.minStockQuantity}
                    onChange={(e) => setFormData({ ...formData, minStockQuantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">تامین‌کننده</label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- بدون تعیین تامین‌کننده --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">توضیحات</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditMaterial(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "در حال به‌روزرسانی..." : "ذخیره تغییرات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingMaterial && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-400" />
                حذف ماده اولیه
              </h3>
              <button
                onClick={() => setDeletingMaterial(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                آیا از حذف کامل ماده اولیه <strong className="text-white">«{deletingMaterial.name}»</strong> با کد{" "}
                <strong className="font-mono text-amber-400">({deletingMaterial.code})</strong> اطمینان دارید؟
              </p>
              <p className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                موجودی فعلی:{" "}
                <span className="font-bold text-white">
                  {Number(deletingMaterial.stockQuantity || 0).toLocaleString("fa-IR")} {deletingMaterial.unit}
                </span>
                <br />
                نکته: در صورت حذف، سوابق قیمت و فرمول ساخت (BOM) وابسته نیز پاکسازی خواهند شد.
              </p>
            </div>

            {deleteErrorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{deleteErrorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingMaterial(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                انصراف
              </button>
              <button
                id="btn-confirm-delete-rm"
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "در حال حذف..." : "بله، حذف شود"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingMaterial && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-emerald-400" />
                تعدیل دستی موجودی انبار
              </h3>
              <button onClick={() => setAdjustMaterial(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              ماده اولیه: <span className="font-bold text-white">{adjustingMaterial.name}</span> | موجودی فعلی:{" "}
              <span className="font-bold text-emerald-400">
                {Number(adjustingMaterial.stockQuantity || 0).toLocaleString("fa-IR")} {adjustingMaterial.unit}
              </span>
            </p>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">موجودی جدید شمارش شده انبار *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-bold text-base focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">دلیل تعدیل موجودی *</label>
                <textarea
                  required
                  placeholder="مثلاً: انبارگردانی پایان دوره، ضایعات یا انحراف شمارش"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white h-20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustMaterial(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "در حال ثبت..." : "تایید و ثبت تعدیل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Drawer */}
      {viewingHistoryMaterial && (
        <div role="dialog" aria-modal="true" className="app-modal fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="h-full w-full max-w-md bg-slate-900 border-r border-slate-800 p-6 shadow-2xl overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="h-5 w-5 text-purple-400" />
                تاریخچه تغییرات قیمت
              </h3>
              <button
                onClick={() => setViewingHistory(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              سوابق قیمت و انحراف نرخ برای: <span className="font-bold text-white">{viewingHistoryMaterial.name}</span>
            </p>

            <div className="space-y-3">
              {priceHistory.length > 0 ? (
                priceHistory.map((ph) => (
                  <div key={ph.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>{toJalaliDate(ph.createdAt)}</span>
                      <span className="font-semibold text-purple-400">{ph.reason}</span>
                    </div>
                    <div className="flex justify-between items-center font-semibold pt-1">
                      <span className="text-slate-500 line-through">
                        {Number(ph.oldCost).toLocaleString("fa-IR")} تومان
                      </span>
                      <span className="text-emerald-400">{Number(ph.newCost).toLocaleString("fa-IR")} تومان</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">هیچ تغییر قیمتی برای این ماده ثبت نشده است.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
