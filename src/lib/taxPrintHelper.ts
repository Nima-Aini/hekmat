/**
 * Standalone Official Tax Declaration Print Engine for Hekmat Akma System
 * Generates an official, high-resolution Iranian Tax Declaration (برگ اظهارنامه مالیاتی رسمی)
 * with self-contained styles, zero external script dependencies, and robust iframe printing.
 */

import { formatMoney, toPersianDigits } from "./dateUtils";
import { numberToPersianWords } from "./numberToWords";

export interface TaxDeclarationPrintData {
  taxpayer: {
    businessName: string;
    nationalId?: string;
    economicCode?: string;
    registrationNumber?: string;
    postalCode?: string;
    companyAddress?: string;
    companyPhone?: string;
    taxOffice?: string;
    corporateTaxRate?: number;
    vatRate?: number;
  };
  statement: {
    invoiceCount: number;
    expenseCount: number;
    grossSales: number;
    totalDiscounts: number;
    netSalesRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalExpenses: number;
    totalCommissions: number;
    totalAllowableDeductions: number;
    taxableOperatingProfit: number;
    corporateTaxAmount: number;
    corporateTaxRate: number;
    calculatedVat: number;
    vatRate: number;
    netRetainedProfit: number;
    totalPaid?: number;
    totalReceivable?: number;
  };
  expenseBreakdown?: Array<{ category: string; amount: number }>;
  period: {
    jalaliStart: string;
    jalaliEnd: string;
    gregorianStart?: string;
    gregorianEnd?: string;
  };
  trackingNumber: string;
  creationDate: string;
}

export function generateTaxDeclarationHtml(data: TaxDeclarationPrintData): string {
  const { taxpayer, statement, expenseBreakdown = [], period, trackingNumber, creationDate } = data;

  const expenseRowsHtml = expenseBreakdown.length > 0
    ? expenseBreakdown.map((item, idx) => `
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: bold; background: #f8fafc; width: 45px;">${idx + 6}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">هزینه‌های: ${item.category || "عمومی و اداری"}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-weight: bold;">${formatMoney(item.amount)}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: bold; background: #f8fafc; width: 45px;">۶</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">هزینه‌های اداری، عمومی، انبارداری و لجستیک</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-weight: bold;">${formatMoney(statement.totalExpenses || 0)}</td>
        </tr>
      `;

  const taxAmountWords = numberToPersianWords(statement.corporateTaxAmount || 0, "تومان");

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>برگ اظهارنامه مالیاتی رسمی - ${taxpayer.businessName}</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      direction: rtl;
      font-size: 11px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .tax-sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm 15mm;
      background: #ffffff;
      box-sizing: border-box;
    }

    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }

    @media print {
      body {
        background: transparent;
      }
      .tax-sheet {
        width: 100%;
        padding: 0;
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
    }

    .header-box {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-col {
      flex: 1;
    }

    .header-center {
      text-align: center;
      flex: 1.4;
    }

    .header-title-badge {
      display: inline-block;
      background: #f1f5f9;
      border: 1.5px solid #0f172a;
      padding: 4px 14px;
      font-weight: 900;
      font-size: 13px;
      border-radius: 4px;
      margin-top: 4px;
    }

    .section-card {
      border: 1.5px solid #0f172a;
      border-radius: 4px;
      margin-bottom: 12px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    .section-header {
      background-color: #e2e8f0;
      color: #0f172a;
      padding: 5px 10px;
      font-weight: 800;
      font-size: 11px;
      border-bottom: 1.5px solid #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-header-dark {
      background-color: #0f172a;
      color: #ffffff;
      padding: 6px 10px;
      font-weight: 800;
      font-size: 11.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tax-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      text-align: right;
    }

    .tax-table th, .tax-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
    }

    .profile-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 14px;
      padding: 10px 12px;
      font-size: 11px;
      background: #ffffff;
    }

    .profile-field {
      display: flex;
      flex-direction: row;
      gap: 4px;
    }

    .profile-label {
      color: #475569;
      font-weight: 600;
      white-space: nowrap;
    }

    .profile-value {
      color: #0f172a;
      font-weight: 800;
    }

    .highlight-row {
      background-color: #f1f5f9;
      font-weight: bold;
    }

    .total-row {
      background-color: #e2e8f0;
      font-weight: 900;
      font-size: 11.5px;
    }

    .signatures-box {
      border: 1.5px solid #0f172a;
      border-radius: 4px;
      padding: 12px 14px;
      margin-top: 14px;
      page-break-inside: avoid;
    }

    .stamp-space {
      height: 60px;
    }
  </style>
</head>
<body>
  <div class="tax-sheet">
    <!-- Header -->
    <div class="header-box">
      <div class="header-col" style="text-align: right; line-height: 1.8;">
        <div>شماره پرونده / پیگیری: <strong style="font-family: monospace; font-size: 12px;">${trackingNumber}</strong></div>
        <div>تاریخ صدور سند: <strong>${creationDate}</strong></div>
        <div>دوره مالیاتی: <strong style="color: #0f172a; font-size: 12px;">${period.jalaliStart} الی ${period.jalaliEnd}</strong></div>
        ${period.gregorianStart ? `<div style="font-size: 9.5px; color: #64748b;">(معادل میلادی: ${period.gregorianStart} الی ${period.gregorianEnd})</div>` : ""}
      </div>

      <div class="header-center">
        <div style="font-size: 11px; font-weight: bold; color: #334155;">جمهوری اسلامی ایران</div>
        <div style="font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">سازمان امور مالیاتی کشور</div>
        <div class="header-title-badge">برگ اظهارنامه مالیات بر عملکرد و ارزش افزوده</div>
      </div>

      <div class="header-col" style="text-align: left; line-height: 1.8;">
        <div>اداره کل امور مالیاتی:</div>
        <div style="font-weight: 800;">${taxpayer.taxOffice || "اداره کل امور مالیاتی"}</div>
        <div style="font-family: monospace; font-size: 9.5px; color: #64748b;">فرم رسمی: INTA-110/PRO</div>
      </div>
    </div>

    <!-- Section 1: Taxpayer Details -->
    <div class="section-card">
      <div class="section-header">
        <span>بخش اول: مشخصات هویتی، قانونی و ثبتی مؤدی مالیاتی (شخص حقوقی / حقیقی)</span>
      </div>
      <div class="profile-grid">
        <div class="profile-field" style="grid-column: span 2;">
          <span class="profile-label">نام شرکت / مؤدی:</span>
          <span class="profile-value">${taxpayer.businessName}</span>
        </div>
        <div class="profile-field">
          <span class="profile-label">شناسه ملی:</span>
          <span class="profile-value" style="font-family: monospace;">${taxpayer.nationalId || "—"}</span>
        </div>

        <div class="profile-field">
          <span class="profile-label">کد اقتصادی:</span>
          <span class="profile-value" style="font-family: monospace;">${taxpayer.economicCode || "—"}</span>
        </div>
        <div class="profile-field">
          <span class="profile-label">شماره ثبت:</span>
          <span class="profile-value" style="font-family: monospace;">${taxpayer.registrationNumber || "—"}</span>
        </div>
        <div class="profile-field">
          <span class="profile-label">کد پستی ۱۰ رقمی:</span>
          <span class="profile-value" style="font-family: monospace;">${taxpayer.postalCode || "—"}</span>
        </div>

        <div class="profile-field">
          <span class="profile-label">تلفن تماس:</span>
          <span class="profile-value" style="font-family: monospace;">${taxpayer.companyPhone || "—"}</span>
        </div>
        <div class="profile-field" style="grid-column: span 2;">
          <span class="profile-label">نشانی اقامتگاه قانونی:</span>
          <span class="profile-value">${taxpayer.companyAddress || "—"}</span>
        </div>
      </div>
    </div>

    <!-- Section 2: Gross Sales & Revenue -->
    <div class="section-card">
      <div class="section-header">
        <span>بخش دوم: جدول محاسبه فروش ناخالص، تخفیفات و درآمد خالص ابرازی</span>
        <span style="font-size: 10px; font-weight: normal;">مبالغ به تومان</span>
      </div>
      <table class="tax-table">
        <tbody>
          <tr>
            <td style="width: 45px; text-align: center; font-weight: bold; background: #f8fafc;">۱</td>
            <td>مجموع فروش ناخالص کالا و خدمات در دوره (${toPersianDigits(statement.invoiceCount)} فقره فاکتور)</td>
            <td style="text-align: left; font-family: monospace; font-weight: 900; width: 170px;">${formatMoney(statement.grossSales)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold; background: #f8fafc;">۲</td>
            <td>تخفیفات، برگشت از فروش، جوایز و تعدیلات نرخ</td>
            <td style="text-align: left; font-family: monospace; color: #475569; width: 170px;">${formatMoney(statement.totalDiscounts)}</td>
          </tr>
          <tr class="highlight-row">
            <td style="text-align: center; font-weight: bold; background: #e2e8f0;">۳</td>
            <td><strong>فروش خالص و درآمدهای عملیاتی دوره</strong> (ردیف ۱ منهای ردیف ۲)</td>
            <td style="text-align: left; font-family: monospace; font-weight: 900; width: 170px; color: #0f172a;">${formatMoney(statement.netSalesRevenue)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold; background: #f8fafc;">۴</td>
            <td>بهای تمام شده کالای فروش رفته (COGS - مواد مصرفی، انبار و تولید)</td>
            <td style="text-align: left; font-family: monospace; width: 170px;">${formatMoney(statement.totalCogs)}</td>
          </tr>
          <tr class="total-row">
            <td style="text-align: center; font-weight: 900; background: #cbd5e1;">۵</td>
            <td><strong>سود (زیان) ناخالص فعالیت تجاری</strong> (ردیف ۳ منهای ردیف ۴)</td>
            <td style="text-align: left; font-family: monospace; font-weight: 900; width: 170px; font-size: 12px;">${formatMoney(statement.grossProfit)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Section 3: Deductible Operating Expenses -->
    <div class="section-card">
      <div class="section-header">
        <span>بخش سوم: جدول هزینه‌های عملیاتی و اداری قابل قبول مالیاتی (مواد ۱۴۷ و ۱۴۸ ق.م.م)</span>
        <span style="font-size: 10px; font-weight: normal;">مبالغ به تومان</span>
      </div>
      <table class="tax-table">
        <tbody>
          ${expenseRowsHtml}
          <tr>
            <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: bold; background: #f8fafc;">پ</td>
            <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">حقوق، دستمزد، پاداش، بازاریابی و پورسانت‌های پرداختی به ویزیتورها و پرسنل</td>
            <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-weight: bold;">${formatMoney(statement.totalCommissions)}</td>
          </tr>
          <tr class="total-row">
            <td style="padding: 6px 10px; border: 1px solid #0f172a; text-align: center; font-weight: 900; background: #cbd5e1;">جمع</td>
            <td style="padding: 6px 10px; border: 1px solid #0f172a;"><strong>جمع کل هزینه‌های عملیاتی قابل قبول دوره مالیاتی</strong></td>
            <td style="padding: 6px 10px; border: 1px solid #0f172a; text-align: left; font-family: monospace; font-weight: 900; font-size: 12px;">${formatMoney(statement.totalAllowableDeductions)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Section 4: Tax Calculation & Corporate Profit -->
    <div class="section-card" style="border: 2px solid #0f172a;">
      <div class="section-header-dark">
        <span>بخش چهارم: محاسبه سود ویژه، مالیات بر درآمد عملکرد و مالیات بر ارزش افزوده (VAT)</span>
        <span style="font-size: 10px; font-weight: normal; color: #cbd5e1;">محاسبه بر اساس قوانین مصوب سازمان مالیاتی</span>
      </div>
      <table class="tax-table">
        <tbody>
          <tr>
            <td style="padding: 8px 10px; font-weight: bold; color: #0f172a;">سود (زیان) ویژه قبل از کسر مالیات (سود ناخالص منهای کل هزینه‌های عملیاتی)</td>
            <td style="padding: 8px 10px; text-align: left; font-family: monospace; font-weight: 900; font-size: 12.5px; width: 170px;">${formatMoney(statement.taxableOperatingProfit)}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 8px 10px;">
              مالیات بر درآمد عملکرد دوره (نرخ مصوب ماده ۱۰۵ ق.م.م: <strong>${statement.corporateTaxRate}%</strong>)
            </td>
            <td style="padding: 8px 10px; text-align: left; font-family: monospace; font-weight: 900; color: #b91c1c; font-size: 12px; width: 170px;">${formatMoney(statement.corporateTaxAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px;">
              مالیات و عوارض بر ارزش افزوده ابرازی فروش (VAT با نرخ مصوب: <strong>${statement.vatRate}%</strong>)
            </td>
            <td style="padding: 8px 10px; text-align: left; font-family: monospace; font-weight: 900; font-size: 12px; width: 170px;">${formatMoney(statement.calculatedVat)}</td>
          </tr>
          <tr class="total-row" style="background: #e2e8f0; border-top: 2px solid #0f172a;">
            <td style="padding: 9px 10px; font-size: 12px;"><strong>سود خالص ویژه دوره مالیاتی پس از کسر تعهدات مالیاتی عملکرد</strong></td>
            <td style="padding: 9px 10px; text-align: left; font-family: monospace; font-weight: 900; font-size: 13px; color: #047857; width: 170px;">${formatMoney(statement.netRetainedProfit)}</td>
          </tr>
        </tbody>
      </table>
      <div style="padding: 8px 12px; background: #f8fafc; border-top: 1px solid #cbd5e1; font-size: 10.5px; color: #334155;">
        مبلغ مالیات عملکرد ابرازی به حروف: <strong>${taxAmountWords}</strong>
      </div>
    </div>

    <!-- Section 5: Signature & Official Certification -->
    <div class="signatures-box">
      <p style="text-align: justify; font-size: 10.5px; line-height: 1.7; color: #334155; margin-bottom: 12px;">
        اینجانب / صاحبان امضای مجاز شرکت با آگاهی کامل از مقررات و احکام قانونی مواد قانون مالیات‌های مستقیم و قانون مالیات بر ارزش افزوده، صحت و اصالت تمامی ارقام، فاکتورها، بهای تمام شده و اسناد مندرج در این اظهارنامه را برای دوره مالیاتی قید شده مورد تأیید و تصدیق قطعی قرار می‌دهیم.
      </p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: center;">
        <div>
          <div style="font-weight: 800; font-size: 11px; margin-bottom: 4px;">مهر و امضای مدیر مالی / حسابدار رسمی</div>
          <div style="font-size: 9.5px; color: #64748b;">تأیید صحت دفاتر، فاکتورها و مبالغ مندرج</div>
          <div class="stamp-space"></div>
          <div style="border-bottom: 1px dashed #94a3b8; width: 60%; margin: 0 auto;"></div>
        </div>
        <div>
          <div style="font-weight: 800; font-size: 11px; margin-bottom: 4px;">مهر رسمی شرکت و امضای مدیرعامل</div>
          <div style="font-size: 9.5px; color: #64748b;">محل مهر رسمی شرکت و امضای مجاز تعهدآور</div>
          <div class="stamp-space"></div>
          <div style="border-bottom: 1px dashed #94a3b8; width: 60%; margin: 0 auto;"></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function triggerTaxDeclarationPrint(data: TaxDeclarationPrintData): void {
  const html = generateTaxDeclarationHtml(data);

  let printFrame = document.getElementById("tax-declaration-print-frame") as HTMLIFrameElement | null;
  if (!printFrame) {
    printFrame = document.createElement("iframe");
    printFrame.id = "tax-declaration-print-frame";
    printFrame.style.position = "fixed";
    printFrame.style.right = "-9999px";
    printFrame.style.bottom = "-9999px";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!frameDoc) {
    window.print();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const handlePrint = () => {
    try {
      printFrame?.contentWindow?.focus();
      printFrame?.contentWindow?.print();
    } catch (e) {
      console.warn("Direct iframe print failed, falling back to window print:", e);
      window.print();
    }
  };

  if (printFrame.contentWindow) {
    if (frameDoc.readyState === "complete") {
      setTimeout(handlePrint, 250);
    } else {
      printFrame.contentWindow.onload = () => {
        setTimeout(handlePrint, 250);
      };
    }
  }
}
