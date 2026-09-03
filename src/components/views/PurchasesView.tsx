"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  CheckCircle,
  X,
  Truck,
  Building2,
  Phone,
  User,
  MapPin,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  FileText
} from "lucide-react";
import { toJalaliDate, formatMoney } from "@/lib/dateUtils";
import { MoneyInput } from "@/components/ui/MoneyInput";

export const PurchasesView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"purchases" | "suppliers">("purchases");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Purchase Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: "",
    paidAmount: 0,
    items: [] as { itemId: string; quantity: number; unitCost: number }[],
    notes: "",
  });

  // Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    code: "",
    name: "",
    contactPerson: "",
    mobile: "",
    phone: "",
    email: "",
    address: "",
    city: "تهران",
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purRes, supRes, rmRes] = await Promise.all([
        fetch("/api/purchases").then((r) => r.json()),
        fetch("/api/suppliers").then((r) => r.json()),
        fetch("/api/raw-materials").then((r) => r.json()),
      ]);

      if (purRes.success) setPurchases(purRes.purchases || []);
      if (supRes.success) setSuppliers(supRes.suppliers || []);
      if (rmRes.success) setRawMaterials(rmRes.rawMaterials || []);
    } catch (err) {
      console.error("Error fetching purchases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleNav = (ev: any) => {
      const data = ev.detail;
      if (data && data.type === "supplier" && data.id) {
        setActiveSubTab("suppliers");
        const found = suppliers.find((s) => s.id === data.id);
        if (found) {
          openSupplierModal(found);
        } else {
          fetch("/api/suppliers")
            .then((r) => r.json())
            .then((res) => {
              if (res.success && res.suppliers) {
                setSuppliers(res.suppliers);
                const s = res.suppliers.find((x: any) => x.id === data.id);
                if (s) openSupplierModal(s);
              }
            });
        }
      }
    };
    window.addEventListener("akma:navigate-item", handleNav);
    return () => window.removeEventListener("akma:navigate-item", handleNav);
  }, [suppliers]);

  const openPurchaseModal = () => {
    setEditingPurchase(null);
    setPurchaseForm({
      supplierId: suppliers[0]?.id || "",
      paidAmount: 0,
      items:
        rawMaterials.length > 0
          ? [{ itemId: rawMaterials[0].id, quantity: 1, unitCost: Number(rawMaterials[0].currentCost) || 0 }]
          : [],
      notes: "",
    });
    setIsPurchaseModalOpen(true);
  };

  const openEditPurchase = async (p: any) => {
    try {
      const res = await fetch(`/api/purchases/${p.id}`).then((r) => r.json());
      if (res.success && res.purchase) {
        const pur = res.purchase;
        setEditingPurchase(pur);
        setPurchaseForm({
          supplierId: pur.supplierId || "",
          paidAmount: Number(pur.paidAmount) || 0,
          items:
            pur.items && pur.items.length > 0
              ? pur.items.map((i: any) => ({
                  itemId: i.itemId,
                  quantity: Number(i.quantity) || 1,
                  unitCost: Number(i.unitCost) || 0,
                }))
              : rawMaterials.length > 0
              ? [{ itemId: rawMaterials[0].id, quantity: 1, unitCost: Number(rawMaterials[0].currentCost) || 0 }]
              : [],
          notes: pur.notes || "",
        });
        setIsPurchaseModalOpen(true);
      } else {
        alert(res.error || "خطا در دریافت اطلاعات فاکتور خرید");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط با سرور");
    }
  };

  const handleDeletePurchase = async (p: any) => {
    if (
      !window.confirm(
        `آیا از ابطال و حذف فاکتور خرید شماره «${p.purchaseNumber}» (${p.supplierName}) به مبلغ ${formatMoney(
          p.grandTotal
        )} اطمینان دارید؟\nمقادیر خریداری‌شده از موجودی انبار مواد اولیه کسر خواهند شد.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/purchases/${p.id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        alert(res.message || "فاکتور خرید با موفقیت ابطال و حذف گردید.");
        await fetchData();
      } else {
        alert(res.error || "خطا در ابطال فاکتور خرید");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط با سرور");
    }
  };

  const addPurchaseItemRow = () => {
    if (rawMaterials.length === 0) return;
    setPurchaseForm({
      ...purchaseForm,
      items: [
        ...purchaseForm.items,
        { itemId: rawMaterials[0].id, quantity: 1, unitCost: Number(rawMaterials[0].currentCost) || 0 },
      ],
    });
  };

  const removePurchaseItemRow = (index: number) => {
    setPurchaseForm({
      ...purchaseForm,
      items: purchaseForm.items.filter((_, i) => i !== index),
    });
  };

  const openSupplierModal = (sup: any = null) => {
    if (sup) {
      setEditingSupplier(sup);
      setSupplierForm({
        code: sup.code || "",
        name: sup.name || "",
        contactPerson: sup.contactPerson || "",
        mobile: sup.mobile || "",
        phone: sup.phone || "",
        email: sup.email || "",
        address: sup.address || "",
        city: sup.city || "تهران",
        notes: sup.notes || "",
      });
    } else {
      setEditingSupplier(null);
      setSupplierForm({
        code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
        name: "",
        contactPerson: "",
        mobile: "",
        phone: "",
        email: "",
        address: "",
        city: "تهران",
        notes: "",
      });
    }
    setIsSupplierModalOpen(true);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.supplierId || purchaseForm.items.length === 0) {
      alert("لطفاً تامین‌کننده و حداقل یک قلم خرید را انتخاب فرمایید.");
      return;
    }

    setPurchaseSaving(true);
    try {
      const url = editingPurchase ? `/api/purchases/${editingPurchase.id}` : "/api/purchases";
      const method = editingPurchase ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseForm),
      }).then((r) => r.json());

      if (res.success) {
        setIsPurchaseModalOpen(false);
        setEditingPurchase(null);
        await fetchData();
        alert(editingPurchase ? "فاکتور خرید با موفقیت ویرایش شد." : "فاکتور خرید با موفقیت ثبت شد و موجودی انبار مواد اولیه و میانگین قیمت خرید به‌روزرسانی شد.");
      } else {
        alert(res.error || "خطا در ثبت یا ویرایش خرید");
      }
    } catch (err: any) {
      alert(err.message || "خطا در سیستم");
    } finally {
      setPurchaseSaving(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim() || !supplierForm.code.trim()) {
      alert("نام تامین‌کننده و کد اختصاصی الزامی است.");
      return;
    }

    setSupplierSaving(true);
    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers";
      const method = editingSupplier ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      }).then((r) => r.json());

      if (res.success) {
        setIsSupplierModalOpen(false);
        setEditingSupplier(null);
        await fetchData();
        alert(editingSupplier ? "اطلاعات تامین‌کننده ویرایش گردید." : "تامین‌کننده جدید با موفقیت ثبت شد.");
      } else {
        alert(res.error || "خطا در ذخیره اطلاعات تامین‌کننده");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط");
    } finally {
      setSupplierSaving(false);
    }
  };

  const handleDeleteSupplier = async (sup: any) => {
    if (!window.confirm(`آیا از ابطال و حذف تامین‌کننده "${sup.name}" (${sup.code}) اطمینان دارید؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/suppliers/${sup.id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        alert("تامین‌کننده با موفقیت باطل و حذف گردید.");
        await fetchData();
      } else {
        alert(res.error || "خطا در حذف تامین‌کننده");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط با سرور");
    }
  };

  const totalPurchaseSum = purchaseForm.items.reduce(
    (acc, curr) => acc + (Number(curr.quantity) || 0) * (Number(curr.unitCost) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-400" />
            مدیریت تامین‌کنندگان و خریدهای مواد اولیه
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ثبت اطلاعات و پرونده تامین‌کنندگان، ورود مواد اولیه به انبار و بروزرسانی خودکار بهای میانگین
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openSupplierModal()}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
          >
            <Plus className="h-4 w-4 text-cyan-400" />
            + تامین‌کننده جدید
          </button>
          <button
            onClick={openPurchaseModal}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" />
            + ثبت فاکتور خرید
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveSubTab("purchases")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            activeSubTab === "purchases"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          فاکتورهای خرید ({purchases.length})
        </button>
        <button
          onClick={() => setActiveSubTab("suppliers")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            activeSubTab === "suppliers"
              ? "border-cyan-500 text-cyan-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Building2 className="h-4 w-4" />
          لیست تامین‌کنندگان ({suppliers.length})
        </button>
      </div>

      {/* Tab 1: Purchases Table */}
      {activeSubTab === "purchases" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
          {purchases.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ShoppingCart className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium">هیچ فاکتور خریدی هنوز ثبت نشده است.</p>
              <button
                onClick={openPurchaseModal}
                className="mt-3 inline-flex items-center gap-1 text-xs bg-emerald-600 px-4 py-2 rounded-xl text-white hover:bg-emerald-500 transition"
              >
                <Plus className="h-4 w-4" />
                ثبت اولین خرید
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-4">شماره خرید</th>
                    <th className="p-4">تاریخ خرید (شمسی)</th>
                    <th className="p-4">تامین‌کننده</th>
                    <th className="p-4">مبلغ کل خرید</th>
                    <th className="p-4">مبلغ پرداخت شده</th>
                    <th className="p-4">وضعیت فاکتور</th>
                    <th className="p-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-emerald-400">{p.purchaseNumber}</td>
                      <td className="p-4 text-slate-300 font-medium">{toJalaliDate(p.purchaseDate)}</td>
                      <td className="p-4 font-bold text-white flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        {p.supplierName}
                      </td>
                      <td className="p-4 font-bold text-slate-100">{formatMoney(p.grandTotal)}</td>
                      <td className="p-4 text-emerald-400 font-medium">{formatMoney(p.paidAmount)}</td>
                      <td className="p-4">
                        <NeonBadge variant="green">ثبت شده در انبار</NeonBadge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditPurchase(p)}
                            className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 hover:text-white transition"
                            title="ویرایش فاکتور خرید"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(p)}
                            className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-500/20 hover:bg-rose-900/50 hover:text-rose-200 transition"
                            title="ابطال و حذف فاکتور خرید"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Suppliers Directory */}
      {activeSubTab === "suppliers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg space-y-3 hover:border-cyan-500/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-slate-500 font-bold">{sup.code}</span>
                    <h3 className="font-bold text-white text-sm">{sup.name}</h3>
                    {sup.contactPerson && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        مسئول: {sup.contactPerson}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openSupplierModal(sup)}
                      className="p-2 rounded-xl bg-slate-800 text-cyan-400 hover:bg-slate-700 hover:text-white transition"
                      title="ویرایش اطلاعات تامین‌کننده"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(sup)}
                      className="p-2 rounded-xl bg-rose-950/30 text-rose-400 border border-rose-500/20 hover:bg-rose-900/40 hover:text-rose-200 transition"
                      title="ابطال و حذف تامین‌کننده"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 border-t border-slate-800 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      شماره موبایل:
                    </span>
                    <span className="font-mono text-cyan-300">{sup.mobile || "—"}</span>
                  </div>
                  {sup.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">تلفن ثابت:</span>
                      <span className="font-mono">{sup.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      شهر / آدرس:
                    </span>
                    <span className="text-slate-400 truncate max-w-[180px]">{sup.city} {sup.address ? `- ${sup.address}` : ""}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={() => {
                      setPurchaseForm({
                        supplierId: sup.id,
                        paidAmount: 0,
                        items:
                          rawMaterials.length > 0
                            ? [{ itemId: rawMaterials[0].id, quantity: 1, unitCost: Number(rawMaterials[0].currentCost) || 0 }]
                            : [],
                        notes: `خرید از ${sup.name}`,
                      });
                      setIsPurchaseModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 hover:bg-emerald-900/40 rounded-xl px-3 py-1.5 transition flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    ثبت خرید از این تامین‌کننده
                  </button>
                </div>
              </div>
            ))}
          </div>

          {suppliers.length === 0 && (
            <div className="p-12 text-center text-slate-400 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
              <Building2 className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium">هیچ تامین‌کننده‌ای تعریف نشده است.</p>
              <button
                onClick={() => openSupplierModal()}
                className="mt-3 inline-flex items-center gap-1 text-xs bg-cyan-600 px-4 py-2 rounded-xl text-white hover:bg-cyan-500 transition"
              >
                <Plus className="h-4 w-4" />
                افزودن اولین تامین‌کننده
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Register Purchase Invoice */}
      {isPurchaseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPurchaseModalOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-400" />
                {editingPurchase ? `ویرایش فاکتور خرید #${editingPurchase.purchaseNumber}` : "ثبت فاکتور خرید مواد اولیه و ورود به انبار"}
              </h3>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-xs"
              >
                <X className="h-4 w-4" />
                <span>بستن</span>
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  انتخاب شرکت تامین‌کننده <span className="text-rose-400">*</span>
                </label>
                <select
                  value={purchaseForm.supplierId}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white focus:border-emerald-500 outline-none"
                >
                  <option value="">-- انتخاب تامین‌کننده --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city}) - {s.mobile}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purchase Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-semibold">
                    اقلام و ردیف‌های مواد اولیه <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addPurchaseItemRow}
                    className="text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-950/30 border border-cyan-500/30 px-3 py-1 rounded-xl transition flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    + افزودن ردیف قلم کالا
                  </button>
                </div>

                {purchaseForm.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">ردیف {idx + 1}</span>
                      {purchaseForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePurchaseItemRow(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">نام ماده اولیه:</label>
                      <select
                        value={item.itemId}
                        onChange={(e) => {
                          const updated = [...purchaseForm.items];
                          const selectedRm = rawMaterials.find((r) => r.id === e.target.value);
                          updated[idx].itemId = e.target.value;
                          if (selectedRm) updated[idx].unitCost = Number(selectedRm.currentCost) || 0;
                          setPurchaseForm({ ...purchaseForm, items: updated });
                        }}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white"
                      >
                        {rawMaterials.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.name} ({rm.unit}) - موجودی فعلی: {rm.stockQuantity} {rm.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">تعداد / مقدار وارده به انبار:</label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="مثال: 50"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...purchaseForm.items];
                            updated[idx].quantity = Number(e.target.value);
                            setPurchaseForm({ ...purchaseForm, items: updated });
                          }}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">قیمت خرید هر واحد:</label>
                        <MoneyInput
                          value={item.unitCost}
                          onChange={(val) => {
                            const updated = [...purchaseForm.items];
                            updated[idx].unitCost = val;
                            setPurchaseForm({ ...purchaseForm, items: updated });
                          }}
                          className="w-full text-xs py-2"
                          unit="تومان"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment and Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">مبلغ پرداخت شده نقد/کارت:</label>
                  <MoneyInput
                    value={purchaseForm.paidAmount}
                    onChange={(val) => setPurchaseForm({ ...purchaseForm, paidAmount: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">توضیحات و شماره حواله خرید:</label>
                  <input
                    type="text"
                    placeholder="توضیحات یا شماره بارنامه/فاکتور فروشنده"
                    value={purchaseForm.notes}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-center justify-between">
                <span className="text-xs text-slate-300">مجموع کل فاکتور خرید:</span>
                <span className="text-base font-black text-emerald-300">{formatMoney(totalPurchaseSum)}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف و بستن
                </button>
                <button
                  type="submit"
                  disabled={purchaseSaving}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                >
                  {purchaseSaving ? "در حال پردازش..." : editingPurchase ? "ذخیره تغییرات فاکتور" : "تأیید و ثبت فاکتور خرید"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Supplier */}
      {isSupplierModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSupplierModalOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-cyan-400" />
                {editingSupplier ? `ویرایش تامین‌کننده (${editingSupplier.name})` : "تعریف تامین‌کننده جدید"}
              </h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-xs"
              >
                <X className="h-4 w-4" />
                <span>بستن</span>
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    کد اختصاصی تامین‌کننده <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: SUP-101"
                    value={supplierForm.code}
                    onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    نام شرکت یا فروشگاه تامین‌کننده <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: پتروشیمی شازند یا بازرگانی رضایی"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نام شخص مسئول / رابط فروش:</label>
                  <input
                    type="text"
                    placeholder="مثال: آقای مهندس حسینی"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">شماره همراه مسئول:</label>
                  <input
                    type="text"
                    placeholder="مثال: 09123456789"
                    value={supplierForm.mobile}
                    onChange={(e) => setSupplierForm({ ...supplierForm, mobile: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تلفن ثابت دفتر مرکزی:</label>
                  <input
                    type="text"
                    placeholder="مثال: 02188888888"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">شهر:</label>
                  <input
                    type="text"
                    placeholder="مثال: تهران یا اصفهان"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">آدرس کامل کارخانه یا دفتر:</label>
                <input
                  type="text"
                  placeholder="آدرس، خیابان، پلاک، طبقه"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و شرایط پرداخت:</label>
                <textarea
                  rows={2}
                  placeholder="مثال: تحویل ۲ روزه، تسویه ۳۰ روزه با چک صیادی"
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف و بستن
                </button>
                <button
                  type="submit"
                  disabled={supplierSaving}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 transition"
                >
                  {supplierSaving ? "در حال ذخیره..." : editingSupplier ? "ذخیره تغییرات" : "ثبت تامین‌کننده"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
