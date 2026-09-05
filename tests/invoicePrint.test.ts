import { describe, expect, it } from "vitest";
import {
  INVOICE_DOCUMENT_WIDTH,
  INVOICE_JPG_OUTPUT_WIDTH,
  INVOICE_JPG_SCALE,
  generateInvoiceHtml,
  type PrintableInvoiceData,
} from "../src/lib/invoicePrintHelper";

function invoiceWithItems(itemCount: number): PrintableInvoiceData {
  return {
    invoice: {
      id: "invoice-1",
      invoiceNumber: "INV-TEST",
      invoiceDate: "2026-09-05T00:00:00.000Z",
      customerName: "مشتری تست",
      subtotal: itemCount * 1000,
      grandTotal: itemCount * 1000,
      paidAmount: 0,
      balanceDue: itemCount * 1000,
    },
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `item-${index + 1}`,
      productNameSnapshot: `قلم ${index + 1}`,
      customNotes: index === 0 ? "توضیح <تست>" : null,
      quantity: 1,
      unitPrice: 1000,
      discountAmount: 0,
      lineTotal: 1000,
    })),
  };
}

describe("canonical invoice document", () => {
  it("uses one fixed document width and deterministic JPG scale", () => {
    const html = generateInvoiceHtml(invoiceWithItems(1));
    const documentRule = html.match(/\.invoice-document\s*\{([\s\S]*?)\}/)?.[1] || "";

    expect(INVOICE_DOCUMENT_WIDTH).toBe(820);
    expect(INVOICE_JPG_SCALE).toBe(2);
    expect(INVOICE_JPG_OUTPUT_WIDTH).toBe(1640);
    expect(documentRule).toContain("width: 820px");
    expect(documentRule).toContain("min-width: 820px");
    expect(documentRule).toContain("max-width: 820px");
    expect(documentRule).toContain("height: auto");
    expect(documentRule).toContain("overflow: visible");
    expect(html).not.toMatch(/@media\s*\(max-width:/);
  });

  it.each([1, 5, 20])("renders all %i item rows without a fixed height", (itemCount) => {
    const html = generateInvoiceHtml(invoiceWithItems(itemCount));
    expect(html.match(/data-invoice-item-row/g)).toHaveLength(itemCount);
    expect(html).not.toMatch(/height:\s*1123px|max-height:\s*\d+px|overflow:\s*hidden;\s*\/\* invoice/);
  });

  it("preserves and escapes custom item notes", () => {
    const html = generateInvoiceHtml(invoiceWithItems(1));
    expect(html).toContain("توضیح &lt;تست&gt;");
  });
});
