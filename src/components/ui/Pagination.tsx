"use client";
import React from "react";
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from "lucide-react";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const Pagination: React.FC<Props> = ({ page, pageSize, total, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const pages: (number | string)[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>
          نمایش {(page - 1) * pageSize + 1} تا {Math.min(page * pageSize, total)} از {total.toLocaleString("fa-IR")} مورد
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} در هر صفحه</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button disabled={!canPrev} onClick={() => onPageChange(1)} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:opacity-40 hover:bg-slate-700">
          <ChevronsRight className="h-4 w-4" />
        </button>
        <button disabled={!canPrev} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:opacity-40 hover:bg-slate-700">
          <ChevronRight className="h-4 w-4" />
        </button>
        {pages.map((p, idx) =>
          typeof p === "string" ? (
            <span key={`e-${idx}`} className="px-1 text-xs text-slate-500">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-medium ${p === page ? "bg-blue-600 text-white" : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {p.toLocaleString("fa-IR")}
            </button>
          )
        )}
        <button disabled={!canNext} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:opacity-40 hover:bg-slate-700">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button disabled={!canNext} onClick={() => onPageChange(totalPages)} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:opacity-40 hover:bg-slate-700">
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
