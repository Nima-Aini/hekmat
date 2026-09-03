"use client";

import React, { useEffect, useState } from "react";
import { MapPin, RefreshCw, Layers, Users, ExternalLink, Navigation } from "lucide-react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { NeshanMap } from "@/components/maps/NeshanMap";

export const CustomerMapView: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedHealth, setSelectedHealth] = useState("all");
  const [activeCustomer, setActiveCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [neshanApiKey, setNeshanApiKey] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [custRes, settRes] = await Promise.all([
        fetch("/api/customers").then((x) => x.json()),
        fetch("/api/settings").then((x) => x.json()),
      ]);
      if (custRes.success) setCustomers(custRes.customers || []);
      if (settRes?.success && settRes.settings) setNeshanApiKey(settRes.settings.neshanApiKey || "");
    } catch (err) {
      console.error("Error fetching map customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = customers.filter((c) => {
    if (selectedHealth === "all") return true;
    if (selectedHealth === "has_location") return c.latitude && c.longitude;
    if (selectedHealth === "no_location") return !c.latitude || !c.longitude;
    return c.healthStatus === selectedHealth;
  });

  const withLocation = customers.filter((c) => c.latitude && c.longitude);
  const withoutLocation = customers.filter((c) => !c.latitude || !c.longitude);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-6 w-6 text-rose-400" />
            نقشه جامع موقعیت مکانی مشتریان و ویزیت
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مشاهده توزیع جغرافیایی مشتریان روی نقشه شبیه‌سازی‌شده تعاملی و مسیریابی ویزیتورها
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedHealth}
            onChange={(e) => setSelectedHealth(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
          >
            <option value="all">همه مشتریان ({customers.length})</option>
            <option value="has_location">دارای لوکیشن ثبت‌شده ({withLocation.length})</option>
            <option value="no_location">بدون لوکیشن ({withoutLocation.length})</option>
            <option value="green">سلامت عالی (سبز)</option>
            <option value="yellow">نیازمند پیگیری (زرد)</option>
            <option value="red">در معرض خطر (قرمز)</option>
          </select>

          <button
            onClick={fetchData}
            title="بروزرسانی داده‌ها"
            className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">کل مشتریان</p>
            <p className="text-lg font-black text-white mt-0.5">{customers.length}</p>
          </div>
          <Users className="h-5 w-5 text-slate-500" />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">دارای لوکیشن نقشه</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{withLocation.length}</p>
          </div>
          <MapPin className="h-5 w-5 text-emerald-400" />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">بدون لوکیشن (اختیاری)</p>
            <p className="text-lg font-black text-amber-400 mt-0.5">{withoutLocation.length}</p>
          </div>
          <Navigation className="h-5 w-5 text-amber-400" />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">نمایش داده شده</p>
            <p className="text-lg font-black text-cyan-400 mt-0.5">{filtered.length}</p>
          </div>
          <Layers className="h-5 w-5 text-cyan-400" />
        </div>
      </div>

      {/* Main Interactive Map */}
      <NeshanMap
        customers={filtered}
        selectedId={activeCustomer?.id}
        onSelectCustomer={setActiveCustomer}
        height="560px"
        neshanApiKey={neshanApiKey}
      />
    </div>
  );
};
