/**
 * Shamsi (Jalali) & Persian Date Utilities for Hekmat Akma Management System
 *
 * Core principle: Database = Gregorian/UTC-safe, UI = Jalali
 * All conversions go through this centralized module.
 */

import * as jalaali from "jalaali-js";

// ─── Persian/Arabic digit conversion ───────────────────────────────────────

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toLatinDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (w) => String(FA_DIGITS.indexOf(w)))
    .replace(/[٠-٩]/g, (w) => String(AR_DIGITS.indexOf(w)));
}

export function toPersianDigits(n: string | number): string {
  if (n === null || n === undefined) return "";
  return String(n).replace(/\d/g, (x) => FA_DIGITS[Number(x)]);
}

// ─── Jalali ↔ Gregorian Conversion ─────────────────────────────────────────

export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

const JALALI_MONTHS = [0, 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

export function isJalaliLeapYear(year: number): boolean {
  return jalaali.isLeapJalaaliYear(year);
}

function jalaliDayOfYear(year: number, month: number, day: number): number {
  let doy = day;
  for (let i = 1; i < month; i++) {
    doy += JALALI_MONTHS[i];
  }
  if (month > 6 && isJalaliLeapYear(year)) doy++;
  return doy;
}

/**
 * Convert Gregorian Date to Jalali
 */
export function gregorianToJalali(date: Date | string | number): JalaliDate {
  const d = new Date(date);
  if (isNaN(d.getTime())) return { year: 0, month: 0, day: 0 };

  const { jy, jm, jd } = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { year: jy, month: jm, day: jd };
}

/**
 * Convert Jalali Date to Gregorian Date
 */
export function jalaliToGregorian(jalali: JalaliDate): Date {
  const { year: jy, month: jm, day: jd } = jalali;
  if (!jy || !jm || !jd || jy < 1000 || !jalaali.isValidJalaaliDate(jy, jm, jd)) {
    return new Date(Number.NaN);
  }
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0));
}

/**
 * Parse a Jalali string "1403/05/15" or "1403-05-15" to Gregorian Date
 */
export function parseJalaliString(str: string): Date | null {
  if (!str) return null;
  const parts = str.split(/[\/\-]/).map((s) => parseInt(toLatinDigits(s.trim()), 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  if (year < 1000 || !jalaali.isValidJalaaliDate(year, month, day)) return null;
  return jalaliToGregorian({ year, month, day });
}

/**
 * Format Jalali date to string "YYYY/MM/DD" in Latin digits
 */
export function jalaliToString(jalali: JalaliDate): string {
  return `${jalali.year}/${String(jalali.month).padStart(2, "0")}/${String(jalali.day).padStart(2, "0")}`;
}

// ─── Date Display Formatting ───────────────────────────────────────────────

export function toJalaliDate(
  dateInput: string | Date | number | null | undefined,
  options: {
    showTime?: boolean;
    format?: "numeric" | "words" | "short";
    persianDigits?: boolean;
  } = {}
): string {
  if (!dateInput) return "—";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";

    const { showTime = false, format = "numeric", persianDigits = true } = options;

    const jDate = gregorianToJalali(d);
    if (jDate.year === 0) return "—";

    if (format === "words") {
      const months = [
        "فروردین", "اردیبهشت", "خرداد",
        "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر",
        "دی", "بهمن", "اسفند"
      ];
      const monthName = months[jDate.month - 1] || "";
      let res = `${jDate.day} ${monthName} ${jDate.year}`;
      if (showTime) {
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        res += ` ساعت ${hh}:${mm}`;
      }
      return persianDigits ? toPersianDigits(res) : res;
    }

    if (format === "short") {
      const months = [
        "فروردین", "اردیبهشت", "خرداد",
        "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر",
        "دی", "بهمن", "اسفند"
      ];
      const monthName = months[jDate.month - 1] || "";
      const res = `${jDate.day} ${monthName}`;
      return persianDigits ? toPersianDigits(res) : res;
    }

    // Default numeric "YYYY/MM/DD"
    const yStr = String(jDate.year);
    const mStr = String(jDate.month).padStart(2, "0");
    const dStr = String(jDate.day).padStart(2, "0");
    let res = `${yStr}/${mStr}/${dStr}`;

    if (showTime) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      res += ` - ${hh}:${mm}`;
    }

    if (persianDigits) {
      res = toPersianDigits(res);
    }

    return res;
  } catch {
    return String(dateInput);
  }
}

// ─── Date Range Helpers (for report filtering) ─────────────────────────────

/**
 * Get start of day in Tehran timezone (UTC+3:30)
 */
export function getStartOfDayJalali(date?: Date | string | number): Date {
  const d = date ? new Date(date) : new Date();
  const tehran = new Date(d.getTime() + 3.5 * 60 * 60 * 1000);
  return new Date(Date.UTC(tehran.getUTCFullYear(), tehran.getUTCMonth(), tehran.getUTCDate()) - 3.5 * 60 * 60 * 1000);
}

/**
 * Get end of day in Tehran timezone (UTC+3:30)
 */
export function getEndOfDayJalali(date?: Date | string | number): Date {
  const start = getStartOfDayJalali(date);
  return new Date(start.getTime() + 86_400_000 - 1);
}

export function parseReportDateParam(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const normalized = toLatinDigits(value.trim());
  const jalali = /^1[34]\d{2}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized) ? parseJalaliString(normalized) : null;
  let date: Date;
  if (jalali) date = jalali;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    date = new Date(normalized);
  }
  if (Number.isNaN(date.getTime())) return null;
  return endOfDay ? getEndOfDayJalali(date) : getStartOfDayJalali(date);
}

/**
 * Get start of Jalali month
 */
export function getStartOfJalaliMonth(jalali: JalaliDate): Date {
  return jalaliToGregorian({ year: jalali.year, month: jalali.month, day: 1 });
}

/**
 * Get end of Jalali month
 */
export function getEndOfJalaliMonth(jalali: JalaliDate): Date {
  const maxDay = jalaali.jalaaliMonthLength(jalali.year, jalali.month);
  const d = jalaliToGregorian({ year: jalali.year, month: jalali.month, day: maxDay });
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Format a Date range for display in Jalali
 */
export function formatDateRangeJalali(start?: Date | null, end?: Date | null): string {
  const s = start ? toJalaliDate(start, { persianDigits: false }) : "—";
  const e = end ? toJalaliDate(end, { persianDigits: false }) : "—";
  return `${s} تا ${e}`;
}

// ─── Quick Date Presets (Jalali-aware) ─────────────────────────────────────

function nowJalali(): JalaliDate {
  return gregorianToJalali(new Date());
}

export function getJalaliPresetRange(preset: string): { start: Date; end: Date } | null {
  const now = nowJalali();
  const today = new Date();

  switch (preset) {
    case "today": {
      return {
        start: getStartOfDayJalali(today),
        end: getEndOfDayJalali(today),
      };
    }
    case "this_week": {
      const dayOfWeek = (today.getDay() + 1) % 7; // Iranian week starts Saturday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      return {
        start: getStartOfDayJalali(startOfWeek),
        end: getEndOfDayJalali(today),
      };
    }
    case "this_month": {
      return {
        start: jalaliToGregorian({ year: now.year, month: now.month, day: 1 }),
        end: getEndOfDayJalali(today),
      };
    }
    case "this_quarter": {
      const quarterMonth = Math.ceil(now.month / 3) * 3 - 2;
      return {
        start: jalaliToGregorian({ year: now.year, month: quarterMonth, day: 1 }),
        end: getEndOfDayJalali(today),
      };
    }
    case "last_3_months":
    case "last_6_months": {
      const months = preset === "last_3_months" ? 3 : 6;
      let year = now.year;
      let month = now.month - (months - 1);
      while (month <= 0) { month += 12; year -= 1; }
      return { start: jalaliToGregorian({ year, month, day: 1 }), end: getEndOfDayJalali(today) };
    }
    case "this_year": {
      return {
        start: jalaliToGregorian({ year: now.year, month: 1, day: 1 }),
        end: getEndOfDayJalali(today),
      };
    }
    case "last_month": {
      const lastMonth = now.month === 1 ? 12 : now.month - 1;
      const lastMonthYear = now.month === 1 ? now.year - 1 : now.year;
      const lastMonthDays = JALALI_MONTHS[lastMonth] || 30;
      return {
        start: jalaliToGregorian({ year: lastMonthYear, month: lastMonth, day: 1 }),
        end: jalaliToGregorian({ year: lastMonthYear, month: lastMonth, day: lastMonthDays }),
      };
    }
    default:
      return null;
  }
}

// ─── Money Formatting ──────────────────────────────────────────────────────

export function formatMoney(amount: number | string | null | undefined, unit: string = "تومان"): string {
  const num = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat("fa-IR").format(num);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatMoneyDual(amountInToman: number | string | null | undefined): string {
  const toman = Math.round(Number(amountInToman) || 0);
  const rial = toman * 10;
  const tomanStr = new Intl.NumberFormat("fa-IR").format(toman);
  const rialStr = new Intl.NumberFormat("fa-IR").format(rial);
  return `${tomanStr} تومان (${rialStr} ریال)`;
}

export function formatRial(amountInToman: number | string | null | undefined): string {
  const rial = Math.round(Number(amountInToman) || 0) * 10;
  return `${new Intl.NumberFormat("fa-IR").format(rial)} ریال`;
}

export function formatNumber(amount: number | string | null | undefined, maxDecimals: number = 4): string {
  if (amount === null || amount === undefined || amount === "") return "۰";
  const num = Number(amount);
  if (isNaN(num)) return "۰";
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

export function formatQuantity(
  amount: number | string | null | undefined,
  unit?: string | null,
  maxDecimals: number = 4
): string {
  const formatted = formatNumber(amount, maxDecimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function getCurrentJalaliDate(): string {
  const now = new Date();
  const jalali = gregorianToJalali(now);
  return jalaliToString(jalali);
}

// ─── Validation Helpers ────────────────────────────────────────────────────

export function isValidJalaliDate(str: string): boolean {
  if (!str) return false;
  const parts = str.split(/[\/\-]/).map((s) => parseInt(toLatinDigits(s.trim()), 10));
  if (parts.length !== 3 || parts.some(isNaN)) return false;
  const [year, month, day] = parts;
  if (year < 1000 || year > 1600) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

export function isValidGregorianDate(date: Date | string | number): boolean {
  const d = new Date(date);
  return !isNaN(d.getTime());
}
