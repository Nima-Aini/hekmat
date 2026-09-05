"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  Layers,
  RefreshCw,
  AlertTriangle,
  Search,
  Package,
  Boxes,
  TrendingUp,
  TrendingDown,
  Filter,
} from "lucide-react";
import { toJalaliDate, formatMoney, formatNumber } from "@/lib/dateUtils";

export const InventoryView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ledger" | "products" | "materials">("ledger");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "product" | "raw_material">("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports?type=inventory").then((r) => r.json());
      if (res.success) setData(res.data);
    } catch (err) {
      console.error("Error fetching inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const rawMaterials: any[] = data?.rawMaterials || [];
  const products: any[] = data?.products || [];
  const ledger: any[] = data?.recentLedger || [];

  const totalProductValue = products.reduce((sum, p) => sum + (Number(p.totalValue) || 0), 0);
  const totalRawMaterialValue = Number(data?.totalRawMaterialValue) || 0;
  const lowStockCount = rawMaterials.filter((r) => r.isLow).length + products.filter((p) => Number(p.stockQuantity) <= 5).length;

  const filteredLedger = ledger.filter((l) => {
    const matchesSearch =
      !searchTerm ||
      (l.itemName && l.itemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.itemCode && l.itemCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.notes && l.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "all" || l.itemType === filterType;
    return matchesSearch && matchesType;
  });

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "production_input":
        return { label: "مصرف در خط تولید", variant: "yellow" as const };
      case "production_output":
        return { label: "خروجی تولید (محصول)", variant: "green" as const };
      case "sale_delivery":
        return { label: "حواله خروج فروش (فاکتور)", variant: "red" as const };
      case "sale_return":
        return { label: "مرجوعی فروش", variant: "blue" as const };
      case "purchase_receipt":
        return { label: "ورود خرید ماده اولیه", variant: "blue" as const };
      case "adjustment":
        return { label: "تعدیل دستی انبار", variant: "purple" as const };
      default:
        return { label: type, variant: "gray" as const };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-sky-400" />
            انبارداری و دفتر کل گردش موجودی (Inventory Ledger)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ردیابی دقیق تغییرات موجودی کالاها و مواد اولیه با نام واقعی و ثبت در دفتر کل انبار
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          به‌روزرسانی انبار
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">ارزش کل انبار مواد اولیه:</span>
            <Boxes className="h-4 w-4 text-sky-400" />
          </div>
          <h3 className="text-2xl font-bold text-sky-400 mt-2">
            {formatMoney(totalRawMaterialValue)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">{formatNumber(rawMaterials.length)} ردیف ماده اولیه</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">ارزش کل انبار محصولات نهایی:</span>
            <Package className="h-4 w-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-400 mt-2">
            {formatMoney(totalProductValue)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">{formatNumber(products.length)} ردیف محصول نهایی</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">اقلام دارای کسری یا هشدار:</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <h3 className="text-2xl font-bold text-amber-400 mt-2">
            {formatNumber(lowStockCount)} <span className="text-xs text-slate-400">مورد</span>
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">نیازمند خرید یا تولید مجدد</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "ledger"
              ? "border-sky-500 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          دفتر کل گردش انبار (تراکنش‌های اخیر)
        </button>
        <button
          onClick={() => setActiveTab("materials")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "materials"
              ? "border-sky-500 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          موجودی انبار مواد اولیه ({formatNumber(rawMaterials.length)})
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "products"
              ? "border-sky-500 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          موجودی انبار محصولات نهایی ({formatNumber(products.length)})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام کالا، کد، یا توضیحات سند..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-9 pl-4 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>

        {activeTab === "ledger" && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none cursor-pointer"
            >
              <option value="all">تمام اقلام (محصول و مواد اولیه)</option>
              <option value="product">فقط محصولات</option>
              <option value="raw_material">فقط مواد اولیه</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Ledger */}
      {activeTab === "ledger" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
          <div className="responsive-table overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">تاریخ ثبت</th>
                  <th className="p-4">کد کالا</th>
                  <th className="p-4">نام واقعی کالا / ماده اولیه</th>
                  <th className="p-4">دسته بندی</th>
                  <th className="p-4">نوع عملیات انبار</th>
                  <th className="p-4 text-center">مقدار تغییر</th>
                  <th className="p-4">موجودی قبلی ← جدید</th>
                  <th className="p-4">نرخ واحد (تومان)</th>
                  <th className="p-4">شرح سند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLedger.length > 0 ? (
                  filteredLedger.map((l: any) => {
                    const badge = getTransactionBadge(l.transactionType);
                    const isPositive = Number(l.quantityChange) > 0;
                    return (
                      <tr key={l.id} className="hover:bg-slate-800/40 transition-all">
                        <td className="p-4 font-mono text-slate-400">{toJalaliDate(l.createdAt)}</td>
                        <td className="p-4 font-mono font-bold text-slate-400">{l.itemCode || "-"}</td>
                        <td className="p-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            {l.itemType === "product" ? (
                              <Package className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Boxes className="h-3.5 w-3.5 text-sky-400" />
                            )}
                            <span>{l.itemName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              l.itemType === "product"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                            }`}
                          >
                            {l.itemType === "product" ? "محصول نهایی" : "ماده اولیه"}
                          </span>
                        </td>
                        <td className="p-4">
                          <NeonBadge variant={badge.variant} size="sm">
                            {badge.label}
                          </NeonBadge>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold text-sm ${
                              isPositive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            {isPositive ? "+" : ""}
                            {formatNumber(l.quantityChange)} {l.unit || ""}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">
                          {formatNumber(l.quantityBefore)} ← <span className="text-white font-bold">{formatNumber(l.quantityAfter)}</span>
                        </td>
                        <td className="p-4 font-mono text-slate-200">
                          {formatNumber(l.unitCostSnapshot)}
                        </td>
                        <td className="p-4 text-slate-400 text-[11px] max-w-[200px] truncate" title={l.notes || ""}>
                          {l.notes || "-"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      هیچ تراکنشی یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Materials */}
      {activeTab === "materials" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
          <div className="responsive-table overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">کد</th>
                  <th className="p-4">نام ماده اولیه</th>
                  <th className="p-4">واحد</th>
                  <th className="p-4">موجودی فعلی</th>
                  <th className="p-4">حداقل مجاز انبار</th>
                  <th className="p-4">قیمت واحد (تومان)</th>
                  <th className="p-4">ارزش کل موجودی</th>
                  <th className="p-4">وضعیت موجودی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rawMaterials.map((rm) => (
                  <tr key={rm.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-mono text-slate-400">{rm.code}</td>
                    <td className="p-4 font-bold text-white">{rm.name}</td>
                    <td className="p-4 text-slate-300">{rm.unit}</td>
                    <td className="p-4 font-mono font-bold text-slate-200">{formatNumber(rm.stockQuantity)}</td>
                    <td className="p-4 font-mono text-slate-400">{formatNumber(rm.minStockQuantity)}</td>
                    <td className="p-4 font-mono text-emerald-400">{formatNumber(rm.currentCost)}</td>
                    <td className="p-4 font-mono font-bold text-sky-400">{formatMoney(rm.totalValue)}</td>
                    <td className="p-4">
                      {Number(rm.stockQuantity) <= 0 ? (
                        <NeonBadge variant="red" size="sm" pulse>
                          موجودی صفر (اتمام)
                        </NeonBadge>
                      ) : rm.isLow ? (
                        <NeonBadge variant="yellow" size="sm" pulse>
                          کمبود موجودی
                        </NeonBadge>
                      ) : (
                        <NeonBadge variant="green" size="sm">
                          کافی
                        </NeonBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Products */}
      {activeTab === "products" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
          <div className="responsive-table overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">کد محصول</th>
                  <th className="p-4">نام محصول نهایی</th>
                  <th className="p-4">دسته‌بندی</th>
                  <th className="p-4">واحد</th>
                  <th className="p-4">موجودی انبار</th>
                  <th className="p-4">بهای تمام شده (BOM)</th>
                  <th className="p-4">قیمت پایه فروش</th>
                  <th className="p-4">ارزش کل موجودی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-mono text-slate-400">{p.code}</td>
                    <td className="p-4 font-bold text-white">{p.name}</td>
                    <td className="p-4 text-slate-300">{p.category || "-"}</td>
                    <td className="p-4 text-slate-300">{p.unit}</td>
                    <td className="p-4 font-mono font-bold text-emerald-400">{formatNumber(p.stockQuantity)}</td>
                    <td className="p-4 font-mono text-slate-300">{formatMoney(p.calculatedCost)}</td>
                    <td className="p-4 font-mono text-cyan-400">{formatMoney(p.basePrice)}</td>
                    <td className="p-4 font-mono font-bold text-emerald-400">{formatMoney(p.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
