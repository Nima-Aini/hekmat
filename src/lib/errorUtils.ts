/**
 * Translates technical database and SQL errors into clean, friendly Persian messages
 */

export function parsePersianError(error: any): string {
  if (!error) return "خطای ناشناخته در پردازش اطلاعات رخ داد.";
  const msg = typeof error === "string" ? error : error.message || error.error || String(error);

  const lower = msg.toLowerCase();

  // Unique constraint
  if (lower.includes("unique constraint") || lower.includes("duplicate key") || lower.includes("duplicate")) {
    if (lower.includes("code")) return "این کد قبلاً در سیستم ثبت شده است. لطفاً از کد دیگری استفاده کنید.";
    if (lower.includes("name")) return "این نام قبلاً در سیستم ثبت شده است.";
    if (lower.includes("mobile") || lower.includes("phone")) return "این شماره تماس قبلاً برای شخص یا مشتری دیگری ثبت شده است.";
    if (lower.includes("national_id")) return "این کد ملی قبلاً در سیستم ثبت شده است.";
    return "اطلاعات با مقدار تکراری ثبت شده است؛ لطفاً مقادیر یکتا وارد نمایید.";
  }

  // Foreign key / Reference constraint
  if (lower.includes("foreign key") || lower.includes("violates foreign key constraint") || lower.includes("referenced from table")) {
    return "این رکورد به دلیل استفاده شدن در فاکتورها، اسناد تولید، حواله‌ها یا سایر بخش‌های سیستم قابل حذف مستقیم نیست.";
  }

  // Not null constraint
  if (lower.includes("not-null") || lower.includes("null value in column")) {
    return "تمامی فیلدهای ستاره‌دار و اجباری باید به درستی تکمیل گردند.";
  }

  // Check constraint & Account balance non-negative
  if (lower.includes("accounts_balance_non_negative") || lower.includes("balance >= 0") || lower.includes("منفی")) {
    return "موجودی حساب کافی نیست و نمی‌تواند منفی باشد.";
  }

  // Insufficient balance / stock
  if (lower.includes("insufficient") || lower.includes("موجودی ناکافی")) {
    return "موجودی کافی برای انجام این عملیات در حساب یا انبار وجود ندارد.";
  }

  // Connection error
  if (lower.includes("connection") || lower.includes("econnrefused") || lower.includes("network")) {
    return "خطا در برقراری ارتباط با پایگاه داده. لطفاً اتصال اینترنت خود را بررسی نمایید.";
  }

  // If already in Persian, return directly
  if (/[\u0600-\u06FF]/.test(msg)) {
    return msg;
  }

  return `خطا در پردازش اطلاعات: ${msg}`;
}
