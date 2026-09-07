"use client";
import React, { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  getJalaliMonthLength,
  gregorianToJalali,
  getJalaliPresetRange,
  jalaliToGregorian,
  parseJalaliString,
  jalaliToString,
  toJalaliDate,
  toLatinDigits,
} from "@/lib/dateUtils";

interface Props {
  value?: string | Date | null; // Gregorian ISO or Date
  onChange: (gregorian: Date | null, jalaliStr: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const JalaliDatePicker: React.FC<Props> = ({
  value,
  onChange,
  label,
  placeholder = "1404/01/01",
  required,
  disabled,
  className = "",
}) => {
  const toJalaliStr = (v: string | number | Date | null | undefined): string => {
    if (!v) return "";
    const d = new Date(v as any);
    if (isNaN(d.getTime())) return "";
    const j = gregorianToJalali(d);
    return jalaliToString(j);
  };

  const [text, setText] = useState(() => toJalaliStr(value as any));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const valueKey: string | number = value instanceof Date ? value.getTime() : value || "";
  const initialView = value ? gregorianToJalali(new Date(value as any)) : gregorianToJalali(new Date());
  const [view, setView] = useState({ year: initialView.year, month: initialView.month });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(toJalaliStr(valueKey));
    if (valueKey) {
      const nextView = gregorianToJalali(new Date(valueKey));
      if (nextView.year) setView({ year: nextView.year, month: nextView.month });
    }
  }, [valueKey]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const handleChange = (val: string) => {
    const latin = toLatinDigits(val);
    setText(latin);
    if (!latin.trim()) {
      setError("");
      onChange(null, "");
      return;
    }
    const parsed = parseJalaliString(latin);
    if (!parsed || isNaN(parsed.getTime())) {
      setError("فرمت تاریخ نامعتبر است. مثال: 1404/06/08");
      return;
    }
    setError("");
    onChange(parsed, latin);
  };

  const handleToday = () => {
    const now = new Date();
    const j = gregorianToJalali(now);
    const str = jalaliToString(j);
    setText(str);
    setError("");
    onChange(jalaliToGregorian(j), str);
    setView({ year: j.year, month: j.month });
    setOpen(false);
  };

  const selectDay = (day: number) => {
    const jalali = { ...view, day };
    const date = jalaliToGregorian(jalali);
    const str = jalaliToString(jalali);
    setText(str);
    setError("");
    setOpen(false);
    onChange(date, str);
  };

  const moveMonth = (amount: number) => {
    setView((current) => {
      const zeroBased = current.year * 12 + current.month - 1 + amount;
      return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12 + 12) % 12 + 1 };
    });
  };

  const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const selected = parseJalaliString(text) ? text.split(/[/-]/).map(Number) : [];
  const firstGregorianDay = jalaliToGregorian({ ...view, day: 1 });
  const leadingEmptyDays = (firstGregorianDay.getUTCDay() + 1) % 7;
  const daysInMonth = getJalaliMonthLength(view.year, view.month);
  const today = gregorianToJalali(new Date());

  return (
    <div ref={rootRef} className={`relative flex min-w-0 flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-slate-300">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <div className="relative flex min-w-0 items-center gap-1">
        <div className="relative flex-1">
          <button type="button" onClick={() => !disabled && setOpen((current) => !current)} disabled={disabled} aria-label="باز کردن تقویم شمسی" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white disabled:pointer-events-none">
            <Calendar className="h-4 w-4" />
          </button>
          <input
            dir="ltr"
            type="text"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => !disabled && setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full min-w-0 rounded-xl border bg-slate-900 py-2 pr-8 pl-8 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:text-sm ${
              error ? "border-rose-500/50" : "border-slate-700"
            }`}
          />
          {text && !disabled && (
            <button
              type="button"
              onClick={() => handleChange("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleToday}
          disabled={disabled}
          className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          امروز
        </button>
      </div>
      {open && !disabled && (
        <div dir="rtl" role="dialog" aria-label="انتخاب تاریخ شمسی" className="absolute right-0 top-full z-[120] mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl shadow-black/60">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد" className="rounded-lg p-2 hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
            <strong className="text-sm">{monthNames[view.month - 1]} {view.year.toLocaleString("fa-IR", { useGrouping: false })}</strong>
            <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل" className="rounded-lg p-2 hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
            {weekDays.map((day) => <span key={day} className="py-1">{day}</span>)}
            {Array.from({ length: leadingEmptyDays }).map((_, index) => <span key={`empty-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
              const isSelected = selected[0] === view.year && selected[1] === view.month && selected[2] === day;
              const isToday = today.year === view.year && today.month === view.month && today.day === day;
              return <button key={day} type="button" onClick={() => selectDay(day)} aria-pressed={isSelected} className={`aspect-square rounded-lg text-xs transition ${isSelected ? "bg-blue-600 font-bold text-white" : isToday ? "border border-cyan-500/60 text-cyan-300" : "text-slate-200 hover:bg-slate-800"}`}>{day.toLocaleString("fa-IR")}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2">
            <button type="button" onClick={() => { handleChange(""); setOpen(false); }} className="rounded-lg px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40">پاک کردن</button>
            <button type="button" onClick={handleToday} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-cyan-300 hover:bg-slate-700">امروز</button>
          </div>
        </div>
      )}
      {error ? (
        <span className="text-[11px] text-rose-400">{error}</span>
      ) : text ? (
        <span className="text-[11px] text-slate-500">
          معادل میلادی: {(() => { const p = parseJalaliString(text); return p ? p.toISOString().slice(0,10) : "—"; })()}
        </span>
      ) : null}
    </div>
  );
};

export const JalaliDateRangePicker: React.FC<{
  startValue?: string | Date | null;
  endValue?: string | Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
}> = ({ startValue, endValue, onChange }) => {
  const startValueKey: string | number = startValue instanceof Date ? startValue.getTime() : startValue || "";
  const endValueKey: string | number = endValue instanceof Date ? endValue.getTime() : endValue || "";
  const [start, setStart] = useState<Date | null>(startValue ? new Date(startValue as any) : null);
  const [end, setEnd] = useState<Date | null>(endValue ? new Date(endValue as any) : null);

  useEffect(() => { setStart(startValueKey ? new Date(startValueKey) : null); }, [startValueKey]);
  useEffect(() => { setEnd(endValueKey ? new Date(endValueKey) : null); }, [endValueKey]);

  const presets: { label: string; key: string }[] = [
    { label: "امروز", key: "today" },
    { label: "این هفته", key: "this_week" },
    { label: "این ماه", key: "this_month" },
    { label: "این فصل", key: "this_quarter" },
    { label: "امسال", key: "this_year" },
  ];

  const applyPreset = (key: string) => {
    const range = getJalaliPresetRange(key);
    if (range) {
      setStart(range.start);
      setEnd(range.end);
      onChange(range.start, range.end);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <JalaliDatePicker value={start as any} onChange={(d) => { setStart(d); onChange(d, end); }} label="از تاریخ" />
        <JalaliDatePicker value={end as any} onChange={(d) => { setEnd(d); onChange(start, d); }} label="تا تاریخ" />
      </div>
      {start && end && (
        <p className="text-xs text-slate-400">
          بازه انتخابی: {toJalaliDate(start)} تا {toJalaliDate(end)}
        </p>
      )}
    </div>
  );
};
