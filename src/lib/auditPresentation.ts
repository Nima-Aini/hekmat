import { formatMoney, formatNumber, toJalaliDate } from "@/lib/dateUtils";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "ایجاد شد", UPDATE: "ویرایش شد", DELETE: "حذف شد", ARCHIVE: "بایگانی شد", REVERSE: "سند معکوس شد",
  LOGIN: "ورود به سامانه", TRANSFER: "انتقال مسئولیت", INVENTORY_TRANSACTION: "تراکنش موجودی",
  ORDER_CREATE: "ایجاد شد", ORDER_CANCEL: "لغو شد", ORDER_CONVERT: "به فاکتور تبدیل شد",
  NOTE_CREATE: "ایجاد شد", NOTE_UPDATE: "ویرایش شد", NOTE_COMPLETE: "تکمیل شد",
  PRODUCTION_COMPLETE: "تکمیل شد", UPDATE_PROJECT_PRICE: "قیمت پروژه تغییر کرد", PRICE_CHANGE: "قیمت تغییر کرد",
  COMMISSION_CHANGE: "قانون پورسانت تغییر کرد", COMMISSION_PAYOUT: "پورسانت پرداخت شد", PERMISSION_CHANGE: "دسترسی‌ها تغییر کرد",
  EMPLOYEE_ACCOUNT_SETUP: "حساب کاربری همکار ایجاد شد", OFFBOARD: "همکاری خاتمه یافت", ALERT_RESOLVE: "هشدار رسیدگی شد",
  PROJECT_TARGET_CREATE: "هدف پروژه ثبت شد", BACKUP_CREATE: "نسخه پشتیبان ایجاد شد", BACKUP_RESTORE: "نسخه پشتیبان بازیابی شد",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  invoice: "فاکتور", order: "سفارش", customer: "مشتری", employee: "همکار", employee_account: "حساب همکار",
  product: "محصول", products_bulk: "محصولات", raw_material: "ماده اولیه", raw_materials_bulk: "مواد اولیه",
  production_batch: "بچ تولید", payment: "پرداخت", expense: "هزینه", purchase: "خرید", supplier: "تأمین‌کننده",
  account: "حساب مالی", project: "پروژه", project_target: "هدف پروژه", note: "یادداشت", task: "وظیفه",
  alert: "هشدار", settings: "تنظیمات", commission_ledger: "دفتر پورسانت", employees_commission: "پورسانت همکاران",
};

const FIELD_LABELS: Record<string, string> = {
  name: "نام", title: "عنوان", code: "کد", status: "وضعیت", amount: "مبلغ", cost: "هزینه", price: "قیمت",
  basePrice: "قیمت پایه", customPrice: "قیمت اختصاصی", invoiceNumber: "شماره فاکتور", orderNumber: "شماره سفارش",
  paymentNumber: "شماره پرداخت", referenceNumber: "شماره پیگیری", quantity: "تعداد", itemCount: "تعداد اقلام",
  customerId: "مشتری", employeeId: "همکار", assignedEmployeeId: "مسئول", projectId: "پروژه", invoiceId: "فاکتور",
  accountId: "حساب", productId: "محصول", role: "نقش", roleCode: "نقش", reason: "دلیل", event: "رویداد",
  dueDate: "سررسید", deliveryDate: "تاریخ تحویل", paymentDate: "تاریخ پرداخت", periodStart: "شروع دوره", periodEnd: "پایان دوره",
  mobile: "موبایل", creditLimit: "سقف اعتبار", commissionRate: "نرخ پورسانت", rateValue: "مقدار نرخ", username: "نام کاربری",
  before: "مقدار قبلی", after: "مقدار جدید", projectSalary: "حقوق پروژه", notes: "توضیحات", description: "شرح",
};

const MONEY_KEY = /(amount|price|cost|total|salary|credit|paid|payable|revenue|profit)/i;
const DATE_KEY = /(date|At|periodStart|periodEnd)$/i;
const VALUE_LABELS: Record<string, string> = {
  open: "باز", ready: "آماده", issued: "صادرشده", paid: "تسویه‌شده", unpaid: "تسویه‌نشده", partial: "پرداخت ناقص",
  active: "فعال", inactive: "غیرفعال", archived: "بایگانی‌شده", cancelled: "لغوشده", completed: "تکمیل‌شده",
  pending: "در انتظار", reversed: "معکوس‌شده", green: "سالم", yellow: "نیازمند توجه", red: "بحرانی",
};

export function auditActionLabel(action?: string | null) {
  if (!action) return "عملیات ثبت‌شده";
  return AUDIT_ACTION_LABELS[action] || action.replaceAll("_", " ").toLocaleLowerCase("fa-IR");
}

export function auditEntityLabel(entityType?: string | null) {
  if (!entityType) return "رکورد";
  return AUDIT_ENTITY_LABELS[entityType] || entityType.replaceAll("_", " ");
}

export function auditFieldLabel(path: string) {
  const key = path.split(".").at(-1) || path;
  return FIELD_LABELS[key] || key.replaceAll("_", " ");
}

export function formatAuditValue(value: unknown, path = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (Array.isArray(value)) return `${formatNumber(value.length)} مورد`;
  if (typeof value === "object") return `${formatNumber(Object.keys(value as object).length)} مشخصه`;
  if (DATE_KEY.test(path)) {
    const formatted = toJalaliDate(String(value), { showTime: /At$/i.test(path) });
    if (formatted !== "—") return formatted;
  }
  if (MONEY_KEY.test(path) && !Number.isNaN(Number(value))) return formatMoney(Number(value));
  if (typeof value === "number") return formatNumber(value);
  if (String(value) === "[REDACTED]") return "اطلاعات محرمانه";
  if (VALUE_LABELS[String(value)]) return VALUE_LABELS[String(value)];
  if (/Id$/i.test(path) && /^[0-9a-f-]{20,}$/i.test(String(value))) return `شناسه …${String(value).slice(-8)}`;
  return String(value);
}

export interface AuditDetailRow { path: string; label: string; before?: string; after?: string; value?: string }

function flatten(value: unknown, prefix = ""): Array<{ path: string; value: unknown }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [{ path: prefix, value }];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child) ? flatten(child, path) : [{ path, value: child }];
  });
}

export function getAuditDetailRows(details: unknown): AuditDetailRow[] {
  if (!details || typeof details !== "object") return [];
  const record = details as Record<string, unknown>;
  const before = record.before && typeof record.before === "object" ? Object.fromEntries(flatten(record.before).map((item) => [item.path, item.value])) : null;
  const after = record.after && typeof record.after === "object" ? Object.fromEntries(flatten(record.after).map((item) => [item.path, item.value])) : null;
  const diffs: AuditDetailRow[] = [];
  if (before || after) {
    const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
    for (const path of keys) {
      const previous = before?.[path];
      const next = after?.[path];
      if (JSON.stringify(previous) !== JSON.stringify(next)) diffs.push({ path, label: auditFieldLabel(path), before: formatAuditValue(previous, path), after: formatAuditValue(next, path) });
    }
  }
  const metadata = Object.fromEntries(Object.entries(record).filter(([key]) => !["before", "after", "ipAddress"].includes(key)));
  return [...diffs, ...flatten(metadata).map(({ path, value }) => ({ path, label: auditFieldLabel(path), value: formatAuditValue(value, path) }))];
}

export function getAuditSummary(log: { action?: string; entityType?: string; details?: unknown }) {
  const rows = getAuditDetailRows(log.details);
  const identity = rows.find((row) => ["invoiceNumber", "orderNumber", "paymentNumber", "name", "title", "code"].includes(row.path));
  const identityValue = identity?.value || identity?.after || identity?.before;
  return identityValue ? `${auditEntityLabel(log.entityType)} «${identityValue}» ${auditActionLabel(log.action)}` : `${auditEntityLabel(log.entityType)} ${auditActionLabel(log.action)}`;
}

export const AUDIT_NAVIGATION: Record<string, string> = {
  invoice: "invoices", order: "orders", customer: "customers", employee: "employees", product: "products",
  raw_material: "raw_materials", production_batch: "production", purchase: "purchases", supplier: "purchases", project: "projects",
  expense: "financial", payment: "financial", account: "financial", note: "notes", alert: "alerts",
};
