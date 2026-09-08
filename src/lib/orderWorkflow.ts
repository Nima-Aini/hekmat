export interface OrderInvoiceDraft {
  orderId: string;
  orderNumber: string;
  customerId: string;
  projectId: string;
  employeeId: string;
  notes: string;
  items: Array<{
    productId: string;
    isCustom: false;
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
    notes: [order.notes, `تبدیل‌شده از سفارش ${order.orderNumber}`].filter(Boolean).join(" - "),
    items: (order.items || []).map((item: any) => ({
      productId: item.productId,
      isCustom: false,
      productName: item.productNameSnapshot || "",
      customNotes: item.notes || "",
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPriceSnapshot),
      discountAmount: 0,
    })),
  };
}
