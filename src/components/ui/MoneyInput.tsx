"use client";

import React, { useState, useEffect } from "react";

interface MoneyInputProps {
  id?: string;
  value: number | string | undefined | null;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  unit?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  allowDecimal?: boolean;
}

// Convert Persian and Arabic numbers to English digits
export function normalizeDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

// Format a number or string with 3-digit commas
export function formatThousands(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "";
  const numStr = normalizeDigits(String(val)).replace(/,/g, "").trim();
  if (numStr === "" || isNaN(Number(numStr))) return numStr;
  
  const parts = numStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// Parse formatted string back to number
export function parseFormattedNumber(val: string): number {
  if (!val) return 0;
  const clean = normalizeDigits(val).replace(/,/g, "").trim();
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

export function displayMoneyValue(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "" || value === 0 || value === "0") return "";
  return formatThousands(value);
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  id,
  value,
  onChange,
  placeholder = "۰",
  className = "",
  unit,
  min,
  max,
  disabled = false,
  required = false,
  autoFocus = false,
  allowDecimal = false,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => displayMoneyValue(value));

  useEffect(() => {
    if (value === undefined || value === null || value === "" || value === 0 || value === "0") {
      setDisplayValue(displayMoneyValue(value));
    } else {
      const currentNumeric = parseFormattedNumber(displayValue);
      const incomingNumeric = Number(value);
      if (currentNumeric !== incomingNumeric) {
        setDisplayValue(formatThousands(value));
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = normalizeDigits(e.target.value);
    
    // Filter allowed characters
    if (allowDecimal) {
      raw = raw.replace(/[^0-9.]/g, "");
      // allow only one dot
      const dotIndex = raw.indexOf(".");
      if (dotIndex !== -1) {
        raw = raw.slice(0, dotIndex + 1) + raw.slice(dotIndex + 1).replace(/\./g, "");
      }
    } else {
      raw = raw.replace(/[^0-9]/g, "");
    }

    if (raw === "") {
      setDisplayValue("");
      onChange(0);
      return;
    }

    const numeric = Number(raw);
    if (min !== undefined && numeric < min) {
      // allow typing lower values while editing, but parse numeric
    }
    if (max !== undefined && numeric > max) {
      return;
    }

    const formatted = formatThousands(raw);
    setDisplayValue(formatted);
    onChange(numeric);
  };

  const baseInputClasses =
    "w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-white font-mono text-left focus:border-cyan-500 focus:outline-none transition " +
    className;

  return (
    <div className="relative flex items-center w-full">
      <input
        id={id}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        className={unit ? `${baseInputClasses} pl-14` : baseInputClasses}
        dir="ltr"
      />
      {unit && (
        <span className="absolute left-2.5 text-[11px] text-slate-400 select-none pointer-events-none font-sans font-medium bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/50">
          {unit}
        </span>
      )}
    </div>
  );
};
