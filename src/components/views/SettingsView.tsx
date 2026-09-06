"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { Settings, Save, RefreshCw, Key, ShieldCheck, Building2, MapPin, Phone, FileText, Percent, CheckCircle2, Map } from "lucide-react";

export const SettingsView: React.FC = () => {
  const [form, setForm] = useState({
    businessName: "سازمان و کسب‌وکار حکمت آکما",
    taxNumber: "",
    economicCode: "",
    nationalId: "",
    registrationNumber: "",
    postalCode: "",
    companyAddress: "",
    companyPhone: "",
    taxOffice: "",
    taxpayerType: "legal",
    taxRateCorporate: 25,
    vatRate: 10,
    currency: "تومان",
    healthGreenThreshold: 75,
    healthYellowThreshold: 50,
    openaiApiKey: "",
    aiEnabled: true,
    mapProvider: "neshan",
    neshanApiKey: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings").then((r) => r.json());
      if (res.success && res.settings) {
        setForm({
          businessName: res.settings.businessName || "سازمان و کسب‌وکار حکمت آکما",
          taxNumber: res.settings.taxNumber || "",
          economicCode: res.settings.economicCode || res.settings.taxNumber || "",
          nationalId: res.settings.nationalId || "",
          registrationNumber: res.settings.registrationNumber || "",
          postalCode: res.settings.postalCode || "",
          companyAddress: res.settings.companyAddress || "",
          companyPhone: res.settings.companyPhone || "",
          taxOffice: res.settings.taxOffice || "",
          taxpayerType: res.settings.taxpayerType || "legal",
          taxRateCorporate: res.settings.taxRateCorporate !== undefined ? res.settings.taxRateCorporate : 25,
          vatRate: res.settings.vatRate !== undefined ? res.settings.vatRate : 10,
          currency: res.settings.currency || "تومان",
          healthGreenThreshold: res.settings.healthGreenThreshold || 75,
          healthYellowThreshold: res.settings.healthYellowThreshold || 50,
          openaiApiKey: res.settings.openaiApiKey || "",
          aiEnabled: res.settings.aiEnabled !== undefined ? res.settings.aiEnabled : true,
          mapProvider: res.settings.mapProvider || "neshan",
          neshanApiKey: res.settings.neshanApiKey || "",
        });
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());

      if (res.success) {
        setSavedSuccess(true);
        window.dispatchEvent(new CustomEvent("akma:settings-updated"));
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        alert(res.error || "خطا در ذخیره تنظیمات");
      }
    } catch (err: any) {
      alert(err.message || "خطا در سیستم");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="h-6 w-6 text-cyan-400" />
            تنظیمات کسب‌وکار، چاپ فاکتور و اظهارنامه مالیاتی
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مشخصات حقوقی سازمان، کد اقتصادی، شناسه ملی، نشانی و اطلاعات تماس (مستقیماً در چاپ فاکتورها و اظهارنامه مالیاتی درج می‌گردد)
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-600/50 px-4 py-2 text-xs font-semibold text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            تنظیمات با موفقیت ذخیره و در فاکتورها اعمال شد.
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Section 1: Business & Legal Identification */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building2 className="h-5 w-5 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">مشخصات هویتی و حقوقی سازمان (فروشنده)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">نام رسمی شرکت / فروشگاه / کسب‌وکار</label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="مثال: شرکت صنایع بازرگانی حکمت آکما"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">عنوان اصلی در سربرگ فاکتور و اظهارنامه مالیاتی</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">شماره ثبت شرکت</label>
              <input
                type="text"
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                placeholder="مثال: ۵۸۴۹۲۱"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">شناسه ملی (۱۱ رقمی)</label>
              <input
                type="text"
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                placeholder="مثال: ۱۰۳۸۰۴۵۹۶۱۰"
                maxLength={14}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">شناسه ملی حقوقی جهت چاپ در فاکتور رسمی و اظهارنامه مالیاتی</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">کد اقتصادی / شماره مالیاتی (۱۲ رقمی)</label>
              <input
                type="text"
                value={form.economicCode}
                onChange={(e) => setForm({ ...form, economicCode: e.target.value, taxNumber: e.target.value })}
                placeholder="مثال: ۴۱۱۵۸۹۳۲۴۷۸۵"
                maxLength={16}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">کد اقتصادی رسمی سازمان امور مالیاتی</span>
            </div>
          </div>
        </div>

        {/* Section 2: Address & Contact Details */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MapPin className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">نشانی پستی، تلفن و اقامتگاه قانونی</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-300 mb-1.5 font-medium">نشانی کامل پستی اقامتگاه قانونی</label>
              <input
                type="text"
                value={form.companyAddress}
                onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
                placeholder="مثال: تهران، خیابان ولیعصر، نرسیده به میدان ونک، پلاک ۱۲، طبقه ۴"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">این نشانی در کادر مشخصات فروشنده در چاپ فاکتورها نمایش داده می‌شود.</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">شماره تلفن ثابت و همراه</label>
              <input
                type="text"
                value={form.companyPhone}
                onChange={(e) => setForm({ ...form, companyPhone: e.target.value })}
                placeholder="مثال: ۰۲۱-۸۸۹۹۰۰۱۱ یا ۰۹۱۲۳۴۵۶۷۸۹"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">کد پستی ۱۰ رقمی</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                placeholder="مثال: ۱۹۹۱۸۳۴۵۶۷"
                maxLength={12}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Tax & Financial Parameters */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Percent className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">پارامترهای گزارش آماده‌سازی مالیاتی</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">نوع مؤدی</label>
              <select value={form.taxpayerType} onChange={(e) => setForm({ ...form, taxpayerType: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none">
                <option value="legal">شخص حقوقی</option>
                <option value="individual">شخص حقیقی</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">اداره کل و حوزه مالیاتی</label>
              <input
                type="text"
                value={form.taxOffice}
                onChange={(e) => setForm({ ...form, taxOffice: e.target.value })}
                placeholder="مثال: اداره کل امور مالیاتی مرکز تهران - حوزه ۶۲"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">نرخ مالیات بر درآمد عملکرد (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.taxRateCorporate}
                onChange={(e) => setForm({ ...form, taxRateCorporate: Number(e.target.value) })}
                placeholder="۲۵"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">نرخ قراردادی/قانونی دوره را پس از تأیید مشاور مالیاتی وارد کنید.</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">نرخ مالیات و عوارض ارزش افزوده (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                placeholder="۱۰"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">نرخ دوره را از بخشنامه و وضعیت کالای مشمول کنترل کنید.</span>
            </div>
          </div>
        </div>

        {/* Section 4: Map Provider */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Map className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">تنظیمات نقشه (Neshan)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">ارائه‌دهنده نقشه</label>
              <select
                value={form.mapProvider}
                onChange={(e) => setForm({ ...form, mapProvider: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="neshan">نشان (Neshan) — پیشنهادی</option>
                <option value="osm">OpenStreetMap (رایگان)</option>
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">پلتفرم پیش‌فرض به صورت خودکار OSM است؛ Neshan با API Key فعال می‌شود.</span>
            </div>
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Neshan API Key (اختیاری)</label>
              <input
                type="password"
                placeholder="web_xxxxxxxxxxxxxxxx"
                value={form.neshanApiKey}
                onChange={(e) => setForm({ ...form, neshanApiKey: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">کلید در سرور ذخیره و هرگز در API عمومی نمایش داده نمی‌شود.</span>
            </div>
          </div>
          {form.mapProvider === "neshan" && !form.neshanApiKey && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
              برای استفاده از نقشه نشان، API Key را از پنل https://platform.neshan.org دریافت و اینجا وارد کنید. تا آن زمان نقشه OSM نمایش داده می‌شود.
            </div>
          )}
        </div>

        {/* Section 5: AI & Gemini Config */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Key className="h-5 w-5 text-purple-400" />
            <h3 className="font-bold text-white text-sm">پیکربندی هوش مصنوعی (Google Gemini)</h3>
          </div>

          <div>
            <label className="block text-slate-300 mb-1.5 font-medium">Gemini API Key (ذخیره امن سمت سرور)</label>
            <input
              type="password"
              placeholder="AIza..."
              value={form.openaiApiKey}
              onChange={(e) => setForm({ ...form, openaiApiKey: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              مدل هوش مصنوعی به‌صورت خودکار بر اساس کلید تنظیم شده پیکربندی می‌شود.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-400">
            تمامی تغییرات در لحظه در ماژول‌های چاپ فاکتور، گزارشات و اظهارنامه اعمال می‌گردد.
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-7 py-3 font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "در حال ذخیره..." : "ذخیره تنظیمات سیستم"}
          </button>
        </div>

        {/* Invoice Seller Info Preview */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileText className="h-5 w-5 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">پیش‌نمایش مشخصات فروشنده در فاکتور چاپی</h3>
          </div>
          <div className="rounded-xl border border-slate-700 bg-white p-4 text-[11px] text-slate-900 space-y-1" style={{ direction: "rtl" }}>
            <div className="font-black text-sm border-b border-slate-300 pb-2 mb-2" style={{ color: "#0f172a" }}>{form.businessName || "نام شرکت"}</div>
            <div style={{ color: "#0f172a" }}><span style={{ color: "#64748b" }}>نام فروشنده: </span><strong>{form.businessName || "—"}</strong></div>
            {form.economicCode && <div style={{ color: "#0f172a" }}><span style={{ color: "#64748b" }}>کد اقتصادی: </span><strong>{form.economicCode}</strong>{form.nationalId ? " | " : ""}{form.nationalId && <><span style={{ color: "#64748b" }}>شناسه ملی: </span><strong>{form.nationalId}</strong></>}</div>}
            {(form.registrationNumber || form.postalCode) && <div style={{ color: "#0f172a" }}>{form.registrationNumber && <><span style={{ color: "#64748b" }}>شماره ثبت: </span>{form.registrationNumber} | </>}{form.postalCode && <><span style={{ color: "#64748b" }}>کد پستی: </span>{form.postalCode}</>}</div>}
            <div style={{ color: "#0f172a" }}><span style={{ color: "#64748b" }}>نشانی و تلفن: </span>{form.companyAddress || "—"}{form.companyPhone ? ` - تلفن: ${form.companyPhone}` : ""}</div>
            {form.taxOffice && <div style={{ color: "#0f172a" }}><span style={{ color: "#64748b" }}>حوزه مالیاتی: </span><strong>{form.taxOffice}</strong></div>}
            <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-200 pt-2">این پیش‌نمایش دقیقاً همان اطلاعاتی است که در کادر «مشخصات فروشنده» فاکتور رسمی چاپ می‌شود.</div>
          </div>
        </div>
      </form>
    </div>
  );
};
