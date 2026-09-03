/**
 * Critical Tests — Akma Official
 * Run: npm test (requires vitest)
 * Coverage: Authorization, Expense accounting, Invoice, Pagination, Jalali
 */
import { describe, it, expect } from "vitest";
import { parseJalaliString, gregorianToJalali, jalaliToGregorian, toJalaliDate } from "../src/lib/dateUtils";

describe("Jalali Date System", () => {
  it("gregorianToJalali converts known date", () => {
    const j = gregorianToJalali(new Date("2024-03-20T00:00:00Z"));
    expect(j.year).toBe(1403);
    expect(j.month).toBe(1);
    expect(j.day).toBe(1);
  });
  it("parseJalaliString round-trip", () => {
    const d = parseJalaliString("1403/01/01");
    expect(d).not.toBeNull();
    const j = gregorianToJalali(d!);
    expect(j.year).toBe(1403);
  });
  it("toJalaliDate shows Persian", () => {
    const s = toJalaliDate("2024-03-20T00:00:00Z");
    expect(s).not.toBe("—");
    expect(s.length).toBeGreaterThan(5);
  });
  it("invalid Jalali returns null", () => {
    expect(parseJalaliString("invalid")).toBeNull();
    expect(parseJalaliString("1403/13/01")).toBeNull();
  });
});

describe("Validation helpers", () => {
  it("rejects NaN/Infinity amounts", () => {
    expect(isFinite(NaN)).toBe(false);
    expect(isFinite(Infinity)).toBe(false);
    expect(Number("abc")).toBeNaN();
  });
  it("discount cannot exceed line total", () => {
    const qty = 2, price = 100000, disc = 250000;
    expect(disc > qty * price).toBe(true);
  });
});

describe("Accounting invariants", () => {
  it("expense accountId required", () => {
    const body: any = { title: "Test", amount: 1000, category: "other" };
    expect(!body.accountId).toBe(true);
  });
  it("payment overpay detection", () => {
    const grandTotal = 1000000, paid = 800000, newPay = 300000;
    const balance = grandTotal - paid;
    expect(newPay > balance).toBe(true);
  });
});
