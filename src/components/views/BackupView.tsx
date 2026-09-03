"use client";

import React, { useEffect, useState, useRef } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import { Database, Download, RefreshCw, Plus, UploadCloud, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toJalaliDate } from "@/lib/dateUtils";

export const BackupView: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<any | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStats, setRestoreStats] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) {
          throw new Error(`خطای سرور (${res.status}): لطفا مجددا تلاش فرمایید.`);
        }
        throw new Error("پاسخ سرور در قالب استاندارد نیست.");
      }
      return data;
    } catch (err: any) {
      throw err;
    }
  };

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const data = await safeFetchJson("/api/backups");
      if (data && data.success) {
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.warn("Notice fetching backups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const data = await safeFetchJson("/api/backups", { method: "POST" });
      if (data && data.success) {
        await fetchBackups();
        alert("پشتیبان‌گیری کامل دیتابیس با هش Checksum اختصاصی با موفقیت انجام و ثبت شد.");
      } else {
        alert(data?.error || "خطا در ایجاد پشتیبان");
      }
    } catch (err: any) {
      alert(err.message || "خطا در سیستم پشتیبان‌گیری");
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreFromId = async (backupId: string) => {
    setRestoring(true);
    setRestoreStats(null);
    try {
      const data = await safeFetchJson(`/api/backups/${backupId}/restore`, {
        method: "POST",
      });

      if (data && data.success) {
        setRestoreStats(data.restoredStats);
        setSelectedBackupForRestore(null);
        alert("بازیابی دیتابیس با موفقیت کامل انجام شد.");
      } else {
        alert(data?.error || "خطا در بازیابی پشتیبان");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط با سرور");
    } finally {
      setRestoring(false);
    }
  };

  const handleUploadAndRestore = async (file: File) => {
    setRestoring(true);
    setRestoreStats(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await safeFetchJson("/api/backups/restore", {
        method: "POST",
        body: formData,
      });

      if (data && data.success) {
        setRestoreStats(data.restoredStats);
        setRestoreFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchBackups();
        alert("فایل پشتیبان با موفقیت بر روی دیتابیس بازیابی شد.");
      } else {
        alert(data?.error || "خطا در بازیابی فایل پشتیبان");
      }
    } catch (err: any) {
      alert(err.message || "خطا در بارگذاری یا بازگردانی فایل");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-400" />
            سیستم پشتیبان‌گیری و بازیابی دیتابیس (Backup & Restore)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تهیه پشتیبان جامع با هش اختصاصی Checksum و امکان بازیابی کامل دیتابیس از فایل یا نسخه‌های پیشین
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Upload File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setRestoreFile(file);
              }
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
            className="flex items-center gap-2 rounded-xl bg-purple-600/20 border border-purple-500/30 px-4 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-600/30 transition-all"
          >
            <UploadCloud className="h-4 w-4" />
            آپلود و بازیابی فایل JSON
          </button>

          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all"
          >
            {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            ایجاد پشتیبان جدید (JSON Snapshot)
          </button>
        </div>
      </div>

      {/* Restore Status Alert */}
      {restoreStats && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-emerald-200">عملیات بازیابی دیتابیس با موفقیت کامل به پایان رسید.</p>
            <p className="text-slate-300">
              تعداد جداول بازیابی شده: <b className="text-white font-mono">{Object.keys(restoreStats).length}</b> جدول
            </p>
          </div>
        </div>
      )}

      {/* File Upload Confirmation Modal */}
      {restoreFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-950 border border-red-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-white text-base">تایید بازیابی فایل پشتیبان</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              شما در حال بازیابی دیتابیس از فایل <span className="font-mono text-amber-300 font-bold">{restoreFile.name}</span> هستید.
              این عملیات کلیه اطلاعات فعلی را با داده‌های این فایل پشتیبان جایگزین خواهد کرد. آیا مطمئن هستید؟
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRestoreFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={() => handleUploadAndRestore(restoreFile)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-500"
              >
                {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                بله، بازیابی کن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Item Restore Confirmation Modal */}
      {selectedBackupForRestore && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-950 border border-amber-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-white text-base">تایید بازگردانی نسخه پشتیبان</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از بازگردانی نسخه <span className="font-mono text-amber-300 font-bold">{selectedBackupForRestore.filename}</span> به تاریخ{" "}
              {toJalaliDate(selectedBackupForRestore.createdAt, { showTime: true })} اطمینان دارید؟
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBackupForRestore(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={() => handleRestoreFromId(selectedBackupForRestore.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-500"
              >
                {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                تایید و بازگردانی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backups List Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">لیست فایل‌های پشتیبان ثبت‌شده در سیستم</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">نام فایل</th>
                <th className="p-3">تاریخ ثبت</th>
                <th className="p-3">حجم فایل</th>
                <th className="p-3">شناسه صحت (Checksum)</th>
                <th className="p-3">وضعیت</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-white">{b.filename}</td>
                  <td className="p-3 text-slate-400">{toJalaliDate(b.createdAt, { showTime: true })}</td>
                  <td className="p-3 text-slate-300">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td className="p-3 font-mono text-[10px] text-slate-500 max-w-[120px] truncate" title={b.checksum}>
                    {b.checksum}
                  </td>
                  <td className="p-3">
                    <NeonBadge variant="green">کامل و معتبر</NeonBadge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`/api/backups/${b.id}`}
                        download={b.filename}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 text-blue-300 hover:bg-blue-500/20 transition-all text-xs"
                      >
                        <Download className="h-3.5 w-3.5" />
                        دانلود
                      </a>
                      <button
                        type="button"
                        onClick={() => setSelectedBackupForRestore(b)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-amber-300 hover:bg-amber-500/20 transition-all text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        بازیابی
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    هیچ فایل پشتیبانی تاکنون ایجاد نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
