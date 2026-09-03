"use client";
import React, { useState, useEffect } from "react";
import { Calendar, X } from "lucide-react";
import {
  gregorianToJalali,
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
  const toJalaliStr = (v: string | Date | null | undefined): string => {
    if (!v) return "";
    const d = new Date(v as any);
    if (isNaN(d.getTime())) return "";
    const j = gregorianToJalali(d);
    return jalaliToString(j);
  };

  const [text, setText] = useState(() => toJalaliStr(value as any));
  const [error, setError] = useState("");

  useEffect(() => {
    setText(toJalaliStr(value as any));
  }, [value as any]);

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
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-slate-300">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <div className="relative flex items-center gap-1">
        <div className="relative flex-1">
          <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            dir="ltr"
            type="text"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full rounded-xl border bg-slate-900 py-2 pr-8 pl-8 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
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
  const [start, setStart] = useState<Date | null>(startValue ? new Date(startValue as any) : null);
  const [end, setEnd] = useState<Date | null>(endValue ? new Date(endValue as any) : null);

  useEffect(() => { setStart(startValue ? new Date(startValue as any) : null); }, [startValue as any]);
  useEffect(() => { setEnd(endValue ? new Date(endValue as any) : null); }, [endValue as any]);

  const presets: { label: string; key: string }[] = [
    { label: "امروز", key: "today" },
    { label: "این هفته", key: "this_week" },
    { label: "این ماه", key: "this_month" },
    { label: "این فصل", key: "this_quarter" },
    { label: "امسال", key: "this_year" },
  ];

  const applyPreset = (key: string) => {
    const { getJalaliPresetRange } = require("@/lib/dateUtils") as typeof import("@/lib/dateUtils");
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
