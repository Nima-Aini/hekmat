import { describe, expect, it } from "vitest";
import { buildOrderInvoiceDraft, isActiveOrderStatus } from "../src/lib/orderWorkflow";
import { CUSTOMER_FINANCIAL_DOCUMENT_WIDTH, generateCustomerFinancialHtml } from "../src/lib/customerFinancialPrintHelper";
import { auditActionLabel } from "../src/lib/auditPresentation";

describe("Order to invoice workflow", () => {
  it("copies real order values into the invoice completion draft", () => {
    const draft = buildOrderInvoiceDraft({ id: "order-1", orderNumber: "ORD-10", customerId: "customer-1", projectId: "project-1", employeeId: "employee-1", notes: "یادداشت", items: [{ productId: "product-1", productNameSnapshot: "محصول", notes: "شرح", quantity: "2", unitPriceSnapshot: "150" }] });
    expect(draft).toMatchObject({ orderId: "order-1", customerId: "customer-1", projectId: "project-1", employeeId: "employee-1" });
    expect(draft.items[0]).toMatchObject({ productId: "product-1", quantity: 2, unitPrice: 150, customNotes: "شرح" });
    expect(draft.notes).toContain("ORD-10");
  });

  it("only considers open and ready orders active", () => {
    expect(["open", "ready", "converted", "cancelled"].filter(isActiveOrderStatus)).toEqual(["open", "ready"]);
  });
});

describe("Customer financial document", () => {
  it("uses a fixed official canvas and renders real financial sections", () => {
    const html = generateCustomerFinancialHtml({ customer: { code: "C-1", name: "مشتری" }, summary: { totalSales: 1000, totalPaid: 400, outstanding: 600, invoiceCount: 1 }, invoices: [{ invoiceNumber: "INV-1", invoiceDate: "2026-01-01", grandTotal: 1000, paidAmount: 400, balanceDue: 600 }], payments: [] });
    expect(CUSTOMER_FINANCIAL_DOCUMENT_WIDTH).toBe(820);
    expect(html).toContain("width:820px");
    expect(html).toContain("INV-1");
    expect(html).toContain("بدهی‌های باز");
  });
});

describe("Legacy audit wording", () => {
  it("never exposes common raw action codes", () => {
    expect(auditActionLabel("update_invoice")).toBe("ویرایش شد");
    expect(auditActionLabel("reverse_payment")).toBe("ابطال شد");
  });
});
