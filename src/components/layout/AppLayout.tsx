"use client";

import React, { useEffect, useRef, useState } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Factory,
  Layers,
  Users,
  MapPin,
  ShoppingCart,
  DollarSign,
  UserCheck,
  BarChart2,
  AlertTriangle,
  Bot,
  Database,
  Settings,
  Folder,
  FolderKanban,
  Search,
  X,
  Menu,
  ChevronDown,
  FileSpreadsheet,
  Sparkles,
  ClipboardList,
  StickyNote,
  ScrollText,
} from "lucide-react";

interface AppLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  me: any;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  setActiveTab,
  selectedProjectId,
  setSelectedProjectId,
  me,
  children,
}) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProjects(data.projects || []);
      })
      .catch((err) => console.error("Error loading projects:", err));
  };

  useEffect(() => {
    loadProjects();
    const handleUpdate = () => loadProjects();
    window.addEventListener("akma:projects-updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.removeEventListener("akma:projects-updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, []);

  useEffect(() => {
    const loadBadges = () => fetch("/api/navigation-badges").then((response) => response.json()).then((data) => data.success && setBadges(data.badges || {})).catch(() => undefined);
    loadBadges();
    const timer = window.setInterval(loadBadges, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    sidebarRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`).then((r) => r.json());
      if (res.success) setSearchResults(res.results || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const navItems = [
    { id: "dashboard", label: "داشبورد مدیریت", icon: LayoutDashboard },
    { id: "invoices", label: "فروش و فاکتورها", icon: ShoppingBag },
    { id: "orders", label: "سفارشات", icon: ClipboardList },
    { id: "raw_materials", label: "مواد اولیه و قطعات", icon: Package },
    { id: "products", label: "محصولات و BOM", icon: Layers },
    { id: "production", label: "بچ‌های تولید", icon: Factory },
    { id: "inventory", label: "انبار و موجودی", icon: Layers },
    { id: "customers", label: "مشتریان و CRM", icon: Users },
    { id: "customer_map", label: "نقشه مشتریان", icon: MapPin },
    { id: "purchases", label: "تامین‌کنندگان و خرید", icon: ShoppingCart },
    { id: "financial", label: "حسابداری و نقدینگی", icon: DollarSign },
    { id: "employees", label: "همکاران و ویزیتورها", icon: UserCheck },
    { id: "projects", label: "پروژه‌ها و Scope", icon: FolderKanban },
    { id: "reports", label: "مرکز گزارشات و سود", icon: BarChart2 },
    { id: "tax_declaration", label: "گزارش آماده‌سازی مالیاتی", icon: FileSpreadsheet },
    { id: "alerts", label: "مرکز اعلانات", icon: AlertTriangle },
    { id: "notes", label: "یادداشت‌ها", icon: StickyNote },
    { id: "audit_logs", label: "لاگ فعالیت‌ها", icon: ScrollText },
    { id: "ai", label: "مشاور هوش مصنوعی", icon: Bot },
    { id: "backup", label: "پشتیبان‌گیری دیتابیس", icon: Database },
    { id: "settings", label: "تنظیمات سیستم", icon: Settings, permission: "settings.view" },
  ];

  const permissionByTab: Record<string, string> = {
    invoices: "invoices.view", orders: "orders.view", raw_materials: "raw_materials.view", products: "products.view", special_products: "products.view", production: "production.view",
    inventory: "inventory.view", customers: "customers.view", customer_map: "customers.view", purchases: "purchases.view",
    financial: "financial.view", employees: "employees.view", projects: "projects.view", reports: "reports.view",
    tax_declaration: "reports.view",
    alerts: "alerts.view", notes: "notes.view", audit_logs: "audit.view", ai: "ai.view", backup: "backup.view", settings: "settings.view",
  };
  const perms = new Set<string>(me?.navigationPermissions || me?.permissions || []);
  const canSee = (id: string) => id === "dashboard" || perms.has("*") || perms.has(permissionByTab[id] || "");
  const visibleNavItems = navItems.filter((item) => canSee(item.id));

  return (
    <div className="app-shell min-h-screen min-w-0 bg-slate-950 text-slate-100 font-sans dir-rtl flex flex-col antialiased">
      {/* Top Header */}
      <header className="app-header sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6 md:grid md:grid-cols-2 md:gap-x-3 lg:flex lg:h-16 lg:items-center lg:justify-between lg:py-0">
        <div className="flex min-w-0 items-center justify-between gap-2 md:col-span-2 lg:contents">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden"
            aria-label="باز کردن منوی اصلی"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-xs font-bold text-white shadow-lg shadow-blue-500/20 sm:text-sm">
              آکما
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xs font-extrabold tracking-tight text-white sm:text-sm">سیستم عملیاتی حکمت آکما</h1>
              <p className="hidden text-[10px] text-slate-400 xl:block">نسخه ۲.۰ - سیستم مدیریت و حسابداری یکپارچه</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 lg:order-last lg:mr-3 lg:gap-2">
          <button
            onClick={() => setMobileSearchOpen((open) => !open)}
            className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-900 hover:text-white md:hidden"
            aria-label={mobileSearchOpen ? "بستن جستجو" : "باز کردن جستجو"}
            aria-expanded={mobileSearchOpen}
          >
            {mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <div className="hidden text-right sm:block">
            <div className="max-w-28 truncate text-xs font-bold text-white">{me?.employee?.name || "کاربر"}</div>
            <div className="max-w-28 truncate text-[10px] text-slate-500">{me?.role?.name || me?.role?.code || ""}</div>
          </div>
          <button onClick={async () => { await fetch("/api/auth/employee-logout", { method: "POST" }); window.location.href = "/employee-login"; }} className="rounded-xl border border-slate-800 px-2.5 py-2 text-[10px] text-slate-400 hover:text-white sm:px-3">خروج</button>
        </div>
        </div>

        {/* Global Project Scope Selector */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs">
            <Folder className="h-4 w-4 text-blue-400" />
            <span className="text-slate-400">اسکوپ پروژه:</span>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value ? e.target.value : null)}
              className="bg-transparent font-bold text-white outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-white">
                تمام پروژه‌ها (اسکوپ عمومی)
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Quick Search */}
        <div className={`${mobileSearchOpen ? "block" : "hidden"} relative mt-2 w-full md:block lg:mt-0 lg:w-48 xl:w-72`}>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی سریع در سیستم..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 pr-9 pl-4 text-base text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none md:py-1.5 md:text-xs"
            />
          </div>

          {/* Quick Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-11 z-50 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md space-y-1">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSearchResults([]);
                    setSearchQuery("");
                    if (item.type === "employee") {
                      setActiveTab("employees");
                    } else if (item.type === "raw_material") {
                      setActiveTab("raw_materials");
                    } else if (item.type === "invoice") {
                      setActiveTab("invoices");
                    } else if (item.type === "customer") {
                      setActiveTab("customers");
                    } else if (item.type === "product") {
                      setActiveTab("products");
                    } else if (item.type === "supplier") {
                      setActiveTab("purchases");
                    } else if (item.type === "account") {
                      setActiveTab("financial");
                    } else if (item.type === "project") {
                      setSelectedProjectId(item.id);
                      setActiveTab("projects");
                    }

                    // Dispatch global event so sub-views can highlight or open item details
                    setTimeout(() => {
                      window.dispatchEvent(
                        new CustomEvent("akma:navigate-item", {
                          detail: { type: item.type, id: item.id, item },
                        })
                      );
                    }, 50);
                  }}
                  className="flex items-center justify-between rounded-xl p-2 hover:bg-slate-800 cursor-pointer text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="text-[10px] text-slate-400">{item.code || item.detail}</p>
                  </div>
                  <NeonBadge variant="blue" size="sm">
                    {item.typeLabel}
                  </NeonBadge>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Workspace Container */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="بستن منوی اصلی"
          />
        )}
        {/* Sidebar Nav */}
        <aside
          ref={sidebarRef}
          tabIndex={-1}
          aria-label="منوی اصلی"
          className={`fixed bottom-0 right-0 top-0 z-50 w-[min(85vw,320px)] transform overflow-y-auto border-l border-slate-800/80 bg-slate-950/98 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl outline-none transition-transform duration-200 ease-in-out lg:static lg:z-30 lg:w-64 lg:translate-x-0 lg:p-4 lg:shadow-none ${
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between lg:hidden mb-4 border-b border-slate-800 pb-3">
            <span className="font-bold text-white text-sm">منوی سیستم</span>
            <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-white" aria-label="بستن منو">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-3 lg:hidden">
            <label htmlFor="mobile-project-scope" className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <Folder className="h-4 w-4 text-blue-400" />
              اسکوپ پروژه
            </label>
            <select
              id="mobile-project-scope"
              value={selectedProjectId || ""}
              onChange={(e) => {
                setSelectedProjectId(e.target.value || null);
                setSidebarOpen(false);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-base font-bold text-white outline-none"
            >
              <option value="">تمام پروژه‌ها (عمومی)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name} ({project.code})</option>
              ))}
            </select>
          </div>

          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isAiAdvisor = item.id === "ai";
              return (
                <div key={item.id} className={`relative isolate rounded-xl ${isAiAdvisor ? "my-2" : ""}`}>
                  {isAiAdvisor && (
                    <>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-purple-500/25 blur-md motion-safe:animate-pulse"
                      />
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 100 40"
                        preserveAspectRatio="none"
                        className="pointer-events-none absolute -inset-[3px] z-10 h-[calc(100%+6px)] w-[calc(100%+6px)] overflow-visible motion-reduce:hidden"
                      >
                        <defs>
                          <linearGradient id="ai-advisor-ring" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#c084fc" />
                            <stop offset="50%" stopColor="#7c3aed" />
                            <stop offset="100%" stopColor="#e879f9" />
                          </linearGradient>
                        </defs>
                        <rect
                          x="1"
                          y="1"
                          width="98"
                          height="38"
                          rx="12"
                          fill="none"
                          stroke="url(#ai-advisor-ring)"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                          pathLength="100"
                          strokeDasharray="24 76"
                        >
                          <animate attributeName="stroke-dashoffset" from="0" to="-100" dur="2.8s" repeatCount="indefinite" />
                        </rect>
                      </svg>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                      isAiAdvisor
                        ? isActive
                          ? "bg-gradient-to-l from-purple-600 to-violet-700 text-white shadow-lg shadow-purple-600/40"
                          : "border border-purple-500/35 bg-gradient-to-l from-purple-950/90 to-violet-950/80 text-purple-100 shadow-lg shadow-purple-950/30 hover:from-purple-800 hover:to-violet-900"
                        : isActive
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isAiAdvisor ? "text-purple-200" : isActive ? "text-white" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                    {(badges[item.id] || 0) > 0 && <span className="mr-auto min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[9px] font-black text-white">{badges[item.id] > 99 ? "99+" : badges[item.id].toLocaleString("fa-IR")}</span>}
                    {isAiAdvisor && <Sparkles className="mr-auto h-3.5 w-3.5 text-fuchsia-300 motion-safe:animate-pulse" />}
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main View Area */}
        <main className="app-main min-w-0 flex-1 overflow-y-auto overflow-x-clip p-3 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
