import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateInvoiceHtml, type PrintableInvoiceData } from "../src/lib/invoicePrintHelper";
import { generateCustomerFinancialHtml } from "../src/lib/customerFinancialPrintHelper";

describe.skipIf(!process.env.PRINT_SAMPLE_DIR)("A5 print samples", () => {
  it("exports short invoice, long proforma and customer financial documents", () => {
    const folder = process.env.PRINT_SAMPLE_DIR!;
    mkdirSync(folder, { recursive: true });
    const example = (count: number, documentType: "invoice" | "proforma"): PrintableInvoiceData => ({
      documentType,
      invoice: { id: "print-test", invoiceNumber: "PRINT-TEST", invoiceDate: "2026-11-22", customerName: "فروشگاه آزمایشی", customerAddress: "تهران، خیابان نمونه، پلاک ۱۲۳", customerMobile: "۰۹۱۲۰۰۰۰۰۰۰", subtotal: count * 120000, invoiceDiscount: 0, grandTotal: count * 120000 },
      items: Array.from({ length: count }, (_, index) => ({ productNameSnapshot: `محصول آزمایشی با نام بلند شماره ${index + 1}`, customNotes: "توضیحات نمونه فارسی برای بررسی شکست خطوط و خوانایی در برگه A5", quantity: 2, unitPrice: 60000, lineTotal: 120000 })),
    });
    const short = generateInvoiceHtml(example(2, "invoice"));
    const long = generateInvoiceHtml(example(48, "proforma"));
    const financial = generateCustomerFinancialHtml({ customer: { name: "فروشگاه آزمایشی", code: "TEST" }, summary: { totalSales: 1000000, totalPaid: 200000, outstanding: 800000, invoiceCount: 40 }, invoices: Array.from({ length: 40 }, (_, i) => ({ invoiceNumber: `INV-${i}`, invoiceDate: "2026-11-22", grandTotal: 25000, paidAmount: 5000, balanceDue: 20000 })), payments: [] });
    expect([short, long, financial].every((html) => html.includes("A5 portrait"))).toBe(true);
    writeFileSync(join(folder, "invoice-short.html"), short);
    writeFileSync(join(folder, "proforma-long.html"), long);
    writeFileSync(join(folder, "customer-financial.html"), financial);
  });
});
