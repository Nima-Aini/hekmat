export interface OrderInvoiceDraft {
  orderId: string;
  orderNumber: string;
  customerId: string;
  projectId: string;
  employeeId: string;
  invoiceDiscount: number;
  notes: string;
  items: Array<{
    productId: string;
    isCustom: boolean;
    productName: string;
    customNotes: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
  }>;
}

export function isActiveOrderStatus(status: string) {
  return status === "open" || status === "ready";
}

export function buildOrderInvoiceDraft(order: any): OrderInvoiceDraft {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    projectId: order.projectId || "",
    employeeId: order.employeeId || "",
    invoiceDiscount: Number(order.invoiceDiscount || 0),
    notes: [order.notes, `تبدیل‌شده از سفارش ${order.orderNumber}`].filter(Boolean).join(" - "),
    items: (order.items || []).map((item: any) => ({
      productId: item.productId || "",
      isCustom: !item.productId,
      productName: item.productNameSnapshot || "",
      customNotes: item.notes || "",
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPriceSnapshot),
      discountAmount: Number(item.discountAmount || 0),
    })),
  };
}

export function buildOrderProforma(order: any) {
  const items = (order.items || []).map((item: any) => {
    const quantity = Number(item.quantity), unitPrice = Number(item.unitPriceSnapshot), discountAmount = Number(item.discountAmount || 0);
    return { productNameSnapshot: item.productNameSnapshot, customNotes: item.notes, quantity, unitPrice, discountAmount, lineTotal: quantity * unitPrice - discountAmount };
  });
  const subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscountsTotal = items.reduce((sum: number, item: any) => sum + item.discountAmount, 0);
  const discount = Number(order.invoiceDiscount || 0);
  return { documentType: "proforma" as const, invoice: {
    id: order.id, invoiceNumber: order.orderNumber, invoiceDate: order.createdAt,
    customerName: order.customerName, customerStore: order.storeName,
    customerMobile: order.customerMobile, customerAddress: order.deliveryAddress || order.customerAddress,
    subtotal, lineDiscountsTotal, invoiceDiscount: discount, grandTotal: subtotal - lineDiscountsTotal - discount,
    notes: [order.notes, order.paymentTerms && `شرایط پرداخت: ${order.paymentTerms}`, order.validUntil && `اعتبار تا: ${order.validUntil}`].filter(Boolean).join(" | "),
  }, items };
}
