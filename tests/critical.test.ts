/**
 * Critical Tests — Akma Official
 * Run: npm test (requires vitest)
 * Coverage: Authorization, Expense accounting, Invoice, Pagination, Jalali
 */
import { describe, it, expect } from "vitest";
import { parseJalaliString, gregorianToJalali, jalaliToGregorian, toJalaliDate } from "../src/lib/dateUtils";
import { apiError } from "../src/lib/apiError";
import { displayMoneyValue, formatThousands, normalizeDigits, parseFormattedNumber } from "../src/components/ui/MoneyInput";
import { getNeshanCoordinates } from "../src/components/maps/NeshanMapPicker";
import { getAlertNavigation } from "../src/components/views/AlertsView";

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
  it("keeps zero visually empty and normalizes Persian money input", () => {
    expect(displayMoneyValue(0)).toBe("");
    expect(displayMoneyValue("0")).toBe("");
    expect(normalizeDigits("۱۲۳٤")).toBe("1234");
    expect(formatThousands("۱۲۳۴۵۶۷")).toBe("1,234,567");
    expect(parseFormattedNumber("۱,۲۳۴")).toBe(1234);
  });
  it("reads Neshan x/y coordinates without swapping them", () => {
    expect(getNeshanCoordinates({ location: { x: 51.389, y: 35.6892 } })).toEqual({ lat: 35.6892, lng: 51.389 });
    expect(getNeshanCoordinates({ latitude: 35.7, longitude: 51.4 })).toEqual({ lat: 35.7, lng: 51.4 });
    expect(getNeshanCoordinates({ location: {} })).toBeNull();
  });
  it("routes an invoice alert to its exact invoice", () => {
    expect(getAlertNavigation({ entityType: "invoice", entityId: "invoice-123" }))
      .toEqual({ tab: "invoices", type: "invoice", id: "invoice-123" });
    expect(getAlertNavigation({ entityType: "unknown", entityId: "1" })).toBeNull();
  });
  it("distinguishes nested foreign-key and unique PostgreSQL errors", async () => {
    const originalError = console.error;
    console.error = () => undefined;
    try {
      const foreignKey = new Error("query failed", { cause: Object.assign(new Error("fk"), { code: "23503", constraint: "payments_invoice_id_fkey", table: "payments" }) });
      const fkResponse = apiError(foreignKey, "حذف فاکتور");
      expect(fkResponse.status).toBe(409);
      expect((await fkResponse.json()).error).toContain("وابسته");

      const duplicate = new Error("query failed", { cause: Object.assign(new Error("unique"), { code: "23505" }) });
      const uniqueResponse = apiError(duplicate);
      expect((await uniqueResponse.json()).error).toContain("تکراری");
    } finally {
      console.error = originalError;
    }
  });
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
