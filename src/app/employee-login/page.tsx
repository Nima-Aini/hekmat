"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, KeyRound, User } from "lucide-react";

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (userToSubmit?: string, passToSubmit?: string) => {
    const u = userToSubmit || username;
    const p = passToSubmit || password;

    if (!u.trim() || !p.trim()) {
      setError("لطفاً نام کاربری و کلمه عبور را وارد فرمایید.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      }).then((v) => v.json());

      if (!res.success) {
        setError(res.error || "نام کاربری یا کلمه عبور نادرست است.");
        return;
      }

      const roleCode = res.role?.code || "visitor";

      if (roleCode === "admin" || roleCode === "manager") {
        router.push("/");
      } else {
        router.push("/employee-dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLogin();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 selection:bg-purple-500 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-xl shadow-purple-900/30 mb-2">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">سامانه جامع مدیریت حکمت آکما</h1>
          <p className="text-xs text-slate-400">
            ورود اختصاصی مدیران، ویزیتورها و حسابداران سیستم
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={submit}
          className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-2xl"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-purple-400" />
              نام کاربری / شماره همراه:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="نام کاربری یا شماره همراه"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-purple-400" />
              کلمه عبور:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 animate-in fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-purple-600 py-3 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>{loading ? "در حال بررسی..." : "ورود به حساب کاربری"}</span>
          </button>
        </form>

        {/* Security notice */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-2.5">
          <p className="text-[11px] text-slate-400 text-center font-medium">
            نکته امنیتی: حساب‌های پیش‌فرض فقط از طریق متغیرهای محیطی INITIAL_ADMIN_USERNAME و INITIAL_ADMIN_PASSWORD قابل ایجاد هستند. برای ورود سریع در محیط توسعه، این مقادیر را در فایل .env تنظیم کنید.
          </p>
        </div>
      </div>
    </main>
  );
}
