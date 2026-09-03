"use client";

import React, { useEffect, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { AlertTriangle, CheckCircle, RefreshCw, Filter } from "lucide-react";
import { toJalaliDate } from "@/lib/dateUtils";

export const AlertsView: React.FC<{ selectedProjectId: string | null }> = ({ selectedProjectId }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const projParam = selectedProjectId ? `?projectId=${selectedProjectId}` : "";
      const res = await fetch(`/api/alerts${projParam}`).then((r) => r.json());
      if (res.success) setAlerts(res.alerts || []);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedProjectId]);

  const handleResolve = async (alertId: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", alertId }),
      }).then((r) => r.json());

      if (res.success) {
        fetchAlerts();
      }
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
            مرکز اعلانات و پایش ناهنجاری‌های سیستم (Alerts Center)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            شناسایی خودکار کمبود موجودی، فاکتورهای سررسید گذشته، افت سلامت مشتریان و انحرافات مالی
          </p>
        </div>

        <button onClick={fetchAlerts} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:text-white">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-3">
        {alerts.length > 0 ? (
          alerts.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`h-5 w-5 mt-0.5 ${
                    a.severity === "critical" ? "text-rose-400 animate-pulse" : "text-amber-400"
                  }`}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{a.title}</h3>
                    <NeonBadge variant={a.severity === "critical" ? "red" : "yellow"} size="sm">
                      {a.severity === "critical" ? "بحرانی" : "هشدار"}
                    </NeonBadge>
                  </div>
                  <p className="text-xs text-slate-300">{a.message}</p>
                  <p className="text-[10px] text-slate-500">{toJalaliDate(a.createdAt, { showTime: true })}</p>
                </div>
              </div>

              {a.status !== "resolved" ? (
                <button
                  onClick={() => handleResolve(a.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-all shrink-0"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  برطرف شد
                </button>
              ) : (
                <NeonBadge variant="gray">برطرف شده</NeonBadge>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-slate-500 text-sm">
            هیچ هشدار فعالی در سیستم وجود ندارد. تمامی شاخص‌های عملیاتی و انبار در وضعیت متوازن قرار دارند.
          </div>
        )}
      </div>
    </div>
  );
};
