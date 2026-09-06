"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { NeshanMapPicker } from "@/components/maps/NeshanMapPicker";
import {
  Users,
  User,
  Plus,
  Edit2,
  MapPin,
  Activity,
  Phone,
  Search,
  RefreshCw,
  X,
  FileText,
  DollarSign,
  Calendar,
  Building,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History
} from "lucide-react";
import { toJalaliDate, formatMoney, formatNumber } from "@/lib/dateUtils";
import { MoneyInput } from "@/components/ui/MoneyInput";

export const CustomersView: React.FC<{ selectedProjectId?: string | null }> = ({ selectedProjectId }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const getCustomerEmployeeName = (c: any) => {
    if (!c) return "تعیین نشده";
    if (c.employeeName && c.employeeName !== "بدون ویزیتور") return c.employeeName;
    if (c.assignedEmployeeName && c.assignedEmployeeName !== "بدون ویزیتور") return c.assignedEmployeeName;
    if (c.assignedEmployeeId) {
      const match = employees.find((e) => e.id === c.assignedEmployeeId);
      if (match) return match.name;
    }
    return "تعیین نشده";
  };

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    storeName: "",
    mobile: "",
    phone: "",
    email: "",
    address: "",
    city: "تهران",
    latitude: null as number | null,
    longitude: null as number | null,
    assignedEmployeeId: "",
    creditLimit: 0,
    settlementTermDays: 30,
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [custRes, empRes] = await Promise.all([
        fetch(`/api/customers?${new URLSearchParams({ page: String(customerPage), pageSize: "20", ...(selectedProjectId ? { projectId: selectedProjectId } : {}), ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}) })}`).then((r) => r.json()),
        fetch("/api/employees").then((r) => r.json()),
      ]);

      if (custRes.success) { setCustomers(custRes.customers || []); setPagination(custRes.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 }); }
      if (empRes.success) setEmployees(empRes.employees || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchData, 250);
    return () => window.clearTimeout(timer);
  }, [selectedProjectId, customerPage, searchTerm]);

  useEffect(() => {
    const handleNav = (ev: any) => {
      const data = ev.detail;
      if (data && data.type === "customer" && data.id) {
        setSearchTerm(data.item?.title || data.item?.code || "");
        const found = customers.find((c) => c.id === data.id);
        if (found) {
          setViewingProfile(found);
        } else {
          fetch(`/api/customers/${data.id}`)
            .then((r) => r.json())
            .then((res) => {
              if (res.success && res.customer) setViewingProfile(res.customer);
            });
        }
      }
    };
    window.addEventListener("akma:navigate-item", handleNav);
    return () => window.removeEventListener("akma:navigate-item", handleNav);
  }, [customers]);

  const openAddModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        code: customer.code || "",
        name: customer.name || "",
        storeName: customer.storeName || "",
        mobile: customer.mobile || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        city: customer.city || "تهران",
        latitude: customer.latitude ? Number(customer.latitude) : null,
        longitude: customer.longitude ? Number(customer.longitude) : null,
        assignedEmployeeId: customer.assignedEmployeeId || "",
        creditLimit: Number(customer.creditLimit || 0),
        settlementTermDays: Number(customer.paymentTermsDays || customer.settlementTermDays || 30),
        notes: customer.notes || "",
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: "",
        storeName: "",
        mobile: "",
        phone: "",
        email: "",
        address: "",
        city: "تهران",
        latitude: null,
        longitude: null,
        assignedEmployeeId: employees[0]?.id || "",
        creditLimit: 0,
        settlementTermDays: 30,
        notes: "",
      });
    }
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.mobile.trim() || !formData.code.trim()) {
      alert("نام مشتری، شماره همراه و کد اختصاصی الزامی هستند.");
      return;
    }

    setSaving(true);
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          paymentTermsDays: formData.settlementTermDays,
          projectId: selectedProjectId || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setIsAddModalOpen(false);
        setEditingCustomer(null);
        await fetchData();
        if (viewingProfile && (editingCustomer?.id === viewingProfile.id || res.customer?.id === viewingProfile.id)) {
          const updatedCustomer = res.customer || { ...viewingProfile, ...formData };
          setViewingProfile(updatedCustomer);
        }
        alert(editingCustomer ? "اطلاعات مشتری ویرایش گردید." : "مشتری جدید با موفقیت ثبت شد.");
      } else {
        alert(res.error || "خطا در ذخیره اطلاعات مشتری");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.storeName && c.storeName.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-cyan-400" />
            باشگاه مشتریان و پرونده‌های فروش
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مشاهده، ثبت و مدیریت مشتریان، کنترل سقف اعتبار، تعیین همکار مسئول و ثبت موقعیت مکانی (اختیاری)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            title="بروزرسانی لیست"
            className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 transition"
          >
            <Plus className="h-4 w-4" />
            + تعریف مشتری جدید
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="جستجوی نام شخص، نام فروشگاه، شماره همراه، یا کد مشتری..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCustomerPage(1); }}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-10 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Customers List Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
          <Users className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-sm">هیچ مشتری با این مشخصات یافت نشد.</p>
          <button
            onClick={() => openAddModal()}
            className="mt-3 inline-flex items-center gap-1 text-xs bg-cyan-600 px-4 py-2 rounded-xl text-white hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            افزودن اولین مشتری
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg space-y-4 hover:border-cyan-500/40 transition group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] text-slate-500 font-bold">{c.code}</span>
                  <h3 className="font-bold text-white text-base mt-0.5 group-hover:text-cyan-300 transition">
                    {c.storeName || c.name}
                  </h3>
                  {c.storeName && c.name && <p className="text-xs text-slate-400">شخص: {c.name}</p>}
                </div>
                <NeonBadge
                  variant={
                    c.healthStatus === "green"
                      ? "green"
                      : c.healthStatus === "yellow"
                      ? "yellow"
                      : "red"
                  }
                >
                  سلامت {c.healthScore || 100}
                </NeonBadge>
              </div>

              <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    شماره همراه:
                  </span>
                  <span className="font-mono font-bold text-cyan-300">{c.mobile}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    همکار مسئول:
                  </span>
                  <span className="text-slate-200">{getCustomerEmployeeName(c)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                    سقف اعتبار:
                  </span>
                  <span className="font-bold text-slate-200">
                    {c.creditLimit ? formatMoney(c.creditLimit) : "بدون سقف"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                    موقعیت مکانی:
                  </span>
                  <span className="text-slate-300">
                    {c.latitude && c.longitude ? (
                      <span className="text-emerald-400 font-medium">ثبت‌شده روی نقشه</span>
                    ) : (
                      <span className="text-slate-500">بدون لوکیشن</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  onClick={() => setViewingProfile(c)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                >
                  <FileText className="h-3.5 w-3.5" />
                  مشاهده سوابق و پرونده
                </button>

                <button
                  onClick={() => openAddModal(c)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  title="ویرایش مشتری"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-slate-300">
          <button type="button" disabled={customerPage <= 1} onClick={() => setCustomerPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-slate-700 px-4 py-2 disabled:opacity-40">صفحه قبل</button>
          <span>صفحه {pagination.page} از {pagination.totalPages} — {pagination.total} مشتری</span>
          <button type="button" disabled={customerPage >= pagination.totalPages} onClick={() => setCustomerPage((p) => Math.min(pagination.totalPages, p + 1))} className="rounded-xl border border-slate-700 px-4 py-2 disabled:opacity-40">صفحه بعد</button>
        </div>
      )}

      {/* Modal 1: Add/Edit Customer */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan-400" />
                {editingCustomer ? `ویرایش اطلاعات مشتری (${editingCustomer.name})` : "تعریف پرونده مشتری جدید"}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-xs"
              >
                <X className="h-4 w-4" />
                <span>بستن</span>
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    کد مشتری <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: CUST-101"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    نام و نام خانوادگی مسئول <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: رضا احمدی"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نام فروشگاه / داروخانه / شرکت:</label>
                  <input
                    type="text"
                    placeholder="مثال: گالری عطر رضوی"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    شماره همراه اصلی <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="09123456789"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تلفن ثابت فروشگاه:</label>
                  <input
                    type="text"
                    placeholder="021..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">همکار و ویزیتور مسئول:</label>
                  <select
                    value={formData.assignedEmployeeId}
                    onChange={(e) => setFormData({ ...formData, assignedEmployeeId: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                  >
                    <option value="">-- بدون همکار مسئول --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || "همکار"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">سقف اعتبار مالی:</label>
                  <MoneyInput
                    value={formData.creditLimit}
                    onChange={(val) => setFormData({ ...formData, creditLimit: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">مهلت تسویه حساب (روز):</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="مثال: 30"
                    value={formData.settlementTermDays}
                    onChange={(e) => setFormData({ ...formData, settlementTermDays: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">شهر:</label>
                  <input
                    type="text"
                    placeholder="تهران"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">آدرس کامل فروشگاه یا انبار:</label>
                <input
                  type="text"
                  placeholder="آدرس دقیق شامل خیابان، کوچه، پلاک، طبقه و واحد"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                />
              </div>

              {/* Map Location Section (Optional) */}
              <div>
                <NeshanMapPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onChange={({ latitude, longitude, address, city }) =>
                    setFormData((prev) => ({
                      ...prev,
                      latitude,
                      longitude,
                      address: prev.address?.trim() ? prev.address : (address || prev.address),
                      city: prev.city?.trim() ? prev.city : (city || prev.city),
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و یادداشت‌های ویژه:</label>
                <textarea
                  rows={2}
                  placeholder="یادداشت‌های پیگیری، حساسیت‌ها، شرایط چک یا تخفیف ویژه مشتری..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف و بستن
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 transition"
                >
                  {saving ? "در حال ذخیره..." : editingCustomer ? "ذخیره تغییرات" : "ثبت پرونده مشتری"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: View Customer Profile */}
      {viewingProfile && (
        <div
          role="dialog"
          aria-modal="true"
          className="app-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{viewingProfile.storeName || viewingProfile.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">کد مشتری: {viewingProfile.code}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingProfile(null)}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-xs"
              >
                <X className="h-4 w-4" />
                <span>بستن</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">شخص مخاطب:</span>
                <b className="text-white">{viewingProfile.name}</b>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">شماره همراه:</span>
                <b className="text-cyan-300 font-mono">{viewingProfile.mobile}</b>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">همکار مسئول:</span>
                <b className="text-white">{getCustomerEmployeeName(viewingProfile)}</b>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">سقف اعتبار:</span>
                <b className="text-emerald-400">
                  {viewingProfile.creditLimit ? formatMoney(viewingProfile.creditLimit) : "بدون سقف"}
                </b>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">مهلت تسویه:</span>
                <b className="text-white">{viewingProfile.settlementTermDays || 30} روز</b>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">تاریخ عضویت (شمسی):</span>
                <b className="text-slate-300">{toJalaliDate(viewingProfile.createdAt)}</b>
              </div>
            </div>

            {viewingProfile.address && (
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">آدرس فروشگاه / انبار:</span>
                <p className="text-slate-200">{viewingProfile.city} - {viewingProfile.address}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  const target = viewingProfile;
                  setViewingProfile(null);
                  openAddModal(target);
                }}
                className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                ویرایش مشخصات
              </button>
              <button
                onClick={() => setViewingProfile(null)}
                className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-500"
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
