# گزارش ممیزی و ارتقای Production ERP/CRM

تاریخ بررسی: ۱۴۰۵/۰۶/۱۵ (2026-09-06)

## A. Root Causes

- پرداخت اولیه فاکتور در UI به‌صورت ISO string ارسال می‌شد، اما Boundary API آن را به `Date` معتبر و کنترل‌شده تبدیل نمی‌کرد. اعتبار حساب فعال نیز قبل از ورود به Transaction تضمین نشده بود.
- پورسانت با یک مبلغ دلخواه پرداخت می‌شد و رکورد منفی Legacy ایجاد می‌کرد؛ اتصال قابل اتکا بین پرداخت و فروش‌های منتخب و حفاظت کافی در برابر درخواست همزمان وجود نداشت.
- گزارش فروش همکاران خالی بود چون Service فیلد `employeePerformances` مورد انتظار UI را تولید نمی‌کرد.
- گزارش‌ها و Dashboard در چند مسیر فاکتورهای لغوشده/برگشت‌شده را فروش محسوب می‌کردند و بعضی Aggregationها پس از دریافت کل جدول در حافظه انجام می‌شد.
- مدل `tasks` در Migration دارای `project_id` بود ولی Drizzle schema آن را نمی‌شناخت؛ یادداشت مستقل، Reminder و ownership روشن وجود نداشت.
- Alertها Pagination/Sort کامل نداشتند، وضعیت‌های lifecycle یکپارچه نبود و علت‌های رفع‌شده در همه دسته‌ها auto-close نمی‌شدند.
- Audit writeها پوشش یکنواخت نداشتند و جزئیات ورودی قبل از ذخیره به‌صورت recursive از secretها پاک نمی‌شد.
- بخش Tax با عبارات «رسمی» نمایش داده می‌شد، در حالی که هیچ اتصال یا شناسه معتبر سامانه مؤدیان/درگاه سازمان مالیاتی نداشت.
- سفارش مستقل وجود نداشت و Workflow قبل از صدور فاکتور قابل ثبت نبود.

## B. Database Findings

### Map اصلی داده

| حوزه | Source of truth | وابستگی‌های مهم |
|---|---|---|
| CRM | `customers` | `customer_assignments`, `customer_project_memberships`, invoices/payments |
| فروش | `invoices`, `invoice_items` | inventory ledger, payments/allocations, commission ledger |
| وصول | `payments`, `payment_allocations` | account balance و وضعیت/مانده invoice |
| پورسانت | `commission_ledger` | invoice, employee, payment و allocation جدید |
| انبار | stock snapshot روی کالا + `inventory_ledger` | invoice/production/purchase references |
| سفارش | `orders`, `order_items` | customer/product؛ فقط هنگام convert به invoice اثر مالی می‌گیرد |
| عملیات | `alerts`, `tasks`, `audit_logs` | project/entity references |

### اصلاحات Schema

- جدول‌های additive `orders`, `order_items`, `commission_payment_allocations` افزوده شدند.
- ستون‌های additive یادداشت: `tasks.project_id`, `created_by_id`, `completed_at`.
- ستون‌های additive Audit: `project_id`, `parent_log_id`.
- ستون `system_settings.taxpayer_type` با default امن `legal` افزوده شد.
- Indexهای پرتکرار برای invoice/customer/employee/project/date/status، payment invoice/account/date، allocationها، commission invoice/employee/status، inventory reference، alert status/severity/date، task due/status، audit entity/date/project و orderها افزوده شدند.
- هیچ Table/Column حذف، truncate یا بازنویسی نشد. Backfill انتساب مشتری فقط رکورد active گمشده را اضافه می‌کند و تاریخچه قبلی را تغییر نمی‌دهد.

### ریسک‌های Data Consistency باقی‌مانده

- `account.balance`, stock snapshot و invoice paid/balance همچنان derived/cached هستند؛ تمام Flowهای اصلاح‌شده transactional شده‌اند، اما Reconciliation عمومی Production باید ابتدا read-only/dry-run طراحی شود.
- داده‌های Legacy پورسانت ممکن است هم row منفی payout و هم row مثبت paid داشته باشند. الگوریتم سازگاری قدیمی FIFO است و داده‌ای را تغییر نمی‌دهد؛ موارد مبهم نیازمند تطبیق حسابدار با اسناد واقعی است.
- Migrationهای قدیمی حساب‌های اولیه با مانده غیرصفر می‌سازند. این Task مانده موجود را دستکاری نکرد؛ باید منبع افتتاحیه Production جداگانه تأیید شود.

## C. Business Logic Findings and Fixes

- ساخت فاکتور، اقلام، انبار، پرداخت اولیه، allocation، account balance و پورسانت در یک Transaction باقی ماند.
- Initial payment فقط با مبلغ finite و غیرمنفی، حساب UUID فعال، تاریخ معتبر و مبلغ حداکثر برابر کل فاکتور پذیرفته می‌شود.
- پورسانت قابل پرداخت برابر سهم پورسانت متناظر با مبلغ وصول‌شده مشتری منهای allocationهای قبلی است.
- انتخاب پورسانت‌ها server-authoritative است؛ مبلغ Client نادیده گرفته می‌شود. Ledger و Account lock می‌شوند و پرداخت، هزینه، allocation، وضعیت و Audit اتمیک ثبت می‌شوند.
- سفارش تا قبل از Convert هیچ اثر حسابداری یا موجودی ندارد. Convert از Service اصلی Invoice استفاده می‌کند، اتمیک است و فقط یک بار مجاز است.
- Dashboard و Reports فقط `issued` invoice را در فروش معتبر می‌شمارند.
- پرداخت API مستقل برای فاکتور، `payment_allocation` را همراه عملیات مالی داخل همان Transaction ثبت می‌کند.
- Alert آماده‌شدن سفارش، موعد یادداشت و رفع کمبود/سررسید به‌صورت deduplicated و تاریخچه‌دار مدیریت می‌شود.

## D. Security Findings

| Severity | Finding | وضعیت |
|---|---|---|
| Critical | API مالی mutating بدون permission | موردی باقی نماند؛ همه Routeهای write غیر-auth با اسکریپت بررسی شدند (به‌جز login/logout). |
| High | secret قدیمی Neshan داخل Source | باقی‌مانده و نیازمند Rotate + تنظیم `NESHAN_API_KEY` قبل از حذف fallback؛ مقدار در گزارش ثبت نشده است. |
| High | restore پشتیبان دارای `TRUNCATE ... CASCADE` | Route قابل دسترس فعالی برای آن پیدا نشد؛ فعال‌سازی آن بدون فرآیند Maintenance/Approval ممنوع است. |
| Medium | Login فاقد rate-limit پایدار و Session فاقد revocation server-side | برای تغییر کم‌ریسک این pass دست‌نخورده؛ پیشنهاد پیاده‌سازی DB-backed lockout/session registry. |
| Medium | چهار advisory ابزار توسعه `drizzle-kit/esbuild` | Runtime Production صفر vulnerability؛ `npm audit fix --force` نسخه breaking نصب می‌کند و اجرا نشد. |
| Low | Audit details ممکن بود secret ذخیره کند | recursive redaction مرکزی افزوده شد. |

Permission Source of Truth همان `roles/permissions/role_permissions/employee_project_assignments` باقی ماند. Navigation از union دسترسی‌های role و project برای نمایش استفاده می‌کند، اما Backend هر action را مجدداً با `requirePermission` enforce می‌کند.

## E. Frontend Findings and Fixes

- Dashboard بازه‌های امروز، هفته، ماه، سه/شش ماه، سال شمسی و Custom Jalali دارد و هنگام refetch داده قبلی را حفظ می‌کند.
- Reports Center تحلیل تخصصی هزینه، محصول، مشتری، پروژه، پورسانت و مقایسه دو دوره را از Server Aggregation نمایش می‌دهد.
- Customer 360 شامل خرید، فاکتورهای paginated، بدهی/سررسید، پرداخت‌ها و محصولات پرتکرار افزوده شد.
- منوی سفارش، یادداشت و لاگ با Permission و Badge افزوده شد.
- Tax فقط یک ورودی مستقل دارد و به‌وضوح «گزارش آماده‌سازی» نام‌گذاری شده است.
- Modalهای مهم فقط با Close/Cancel/Save موفق بسته می‌شوند؛ backdrop/Escape داده فرم را از بین نمی‌برد.
- Loading اولیه در Flowهای جدید به‌جای Empty State کاذب نمایش داده می‌شود.
- کنترل Sort فاکتور روی Desktop/Mobile واضح است و Sort قبل از Pagination در SQL اجرا می‌شود.
- AI Advisor با رنگ و انیمیشن بنفش در Navigation برجسته شده است.

## F. Missing Features

| Feature | Why Needed | Priority | Complexity | Risk |
|---|---|---:|---:|---:|
| Reconciliation dry-run عمومی | کشف drift مانده حساب/فاکتور/انبار بدون تغییر داده | Critical | High | Financial |
| Login rate limiting + revocable sessions | کاهش brute force و امکان قطع Session | Recommended | Medium | Security |
| Approval workflow مالی | تفکیک ثبت‌کننده/تأییدکننده هزینه، حذف و payout | Recommended | High | Financial |
| اتصال رسمی سامانه مؤدیان | ارسال واقعی صورتحساب و دریافت وضعیت/شناسه مالیاتی | Recommended | High | Legal |
| Stock reservation اختیاری سفارش | جلوگیری از فروش موجودی وعده‌داده‌شده | Nice-to-have | Medium | Operational |
| Import/Export استاندارد | مهاجرت و پاک‌سازی داده با Validation | Nice-to-have | Medium | Data quality |

## G. Implemented Features

- Dashboard اجرایی Date-range و KPI/Trendهای فروش، سود، وصول، مطالبات و کمبود مواد.
- موتور پورسانت وصول‌محور با allocation جزئی، انتخاب فروش و جلوگیری از double-pay.
- Sort/Pagination واقعی فاکتور و کنترل واضح UI.
- Reports server-side و رفع فروش همکاران.
- Customer 360.
- Orders lifecycle: open/ready/converted/cancelled، Alert و Convert اتمیک.
- Notes/Reminder سازمانی و پروژه‌ای با Badge.
- Alerts pagination/filter/sort/navigation/auto-close.
- Audit log immutable UI با filter/pagination و redaction.
- یک Tax preparation entry با سال شمسی پویا و disclaimer حقوقی.
- Loading و UXهای shared/critical قبلی شامل MoneyInput، Modal، Map، invoice print و AI highlight حفظ شدند.

## H. Migration Report

Migration در `src/db/migrate.ts` هنگام startup برنامه اجرا می‌شود و idempotent است:

- `CREATE TABLE IF NOT EXISTS` برای order و commission allocation.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` برای ستون‌های جدید.
- `CREATE INDEX IF NOT EXISTS` برای indexها.
- `INSERT ... ON CONFLICT DO NOTHING` برای permissionها و backfill قطعی.

اثر بر داده فعلی: هیچ حذف یا overwrite تاریخی ندارد. قبل از Deploy گرفتن snapshot/backup استاندارد Infrastructure توصیه می‌شود؛ Restore داخلی برنامه نباید در Production بدون Maintenance window استفاده شود.

## I. Deep Research Tax Findings

نتیجه حقوقی/فنی:

- برای شخص حقوقی، اظهارنامه عملکرد و صورت‌های مالی/اطلاعات مرتبط طبق ماده ۱۱۰ قانون مالیات‌های مستقیم باید در مهلت قانونی پس از پایان سال مالی ارائه شود؛ نوع مؤدی باید در Company Settings قطعی شود.
- صورتحساب الکترونیکی معتبر سامانه مؤدیان نیازمند قالب، فیلدها، شماره منحصر‌به‌فرد مالیاتی و ثبت/پذیرش در کارپوشه است. PDF داخلی این نرم‌افزار چنین اعتباری ایجاد نمی‌کند.
- VAT را نمی‌توان صرفاً `فروش × نرخ تنظیمات` به عنوان بدهی قطعی معرفی کرد؛ گزارش اکنون مالیات ثبت‌شده روی اسناد را جدا از برآورد نرخ تنظیمات نشان می‌دهد.
- پذیرش هزینه مالیاتی تابع سند، ماهیت و مقررات است؛ نرم‌افزار دیگر همه هزینه‌ها را به‌عنوان «قابل قبول قطعی» معرفی نمی‌کند.
- ارسال قانونی باید از Portal/Integration رسمی انجام شود؛ این Task هیچ Submit ساختگی پیاده نکرد.

منابع با تاریخ دسترسی 2026-09-06:

- [پایگاه ملی قوانین و مقررات کشور (معاونت حقوقی ریاست جمهوری)](https://dotic.ir/)
- [قانون مالیات بر ارزش افزوده در پایگاه ملی قوانین](https://dotic.ir/news/9684)
- [درگاه ملی خدمات الکترونیک مالیاتی](https://my.tax.gov.ir/)
- [درگاه سازمان امور مالیاتی کشور](https://tax.gov.ir/)
- [درگاه/کارپوشه سامانه مؤدیان](https://tp.tax.gov.ir/)
- [مرجع انتشار اسناد سامانه مؤدیان](https://intamedia.ir/)
- [متن بازآرایی‌شده دستورالعمل صدور صورتحساب الکترونیکی و لینک PDF رسمی](https://thdorsan.com/vaset/%D8%AF%D8%B3%D8%AA%D9%88%D8%B1%D8%A7%D9%84%D8%B9%D9%85%D9%84-%D8%B5%D8%AF%D9%88%D8%B1-%D8%B5%D9%88%D8%B1%D8%AA%D8%AD%D8%B3%D8%A7%D8%A8-%D8%A7%D9%84%DA%A9%D8%AA%D8%B1%D9%88%D9%86%DB%8C%DA%A9%DB%8C-%D8%A2%D8%B0%D8%B1-1403) — mirror ثانویه، فقط برای دسترسی به سندی که سایت رسمی از محیط Audit timeout داشت.

محدودیت Research: چند Portal رسمی ایران از محیط Build پاسخ timeout/403 دادند؛ بنابراین هیچ نرخ/مهلت سالانه متغیر Hardcode یا ادعای تأیید رسمی در محصول اضافه نشد.

## J. Tests

- Migration دوبار روی PostgreSQL/PGlite اجرا شد و schema drift/required-column blocker نداشت.
- پورسانت انتخابی ۱ و ۳، نگه‌داشتن ۲، double-submit/race و account/expense/payment.
- پورسانت جزئی بر اساس وصول ۴۰٪ و سپس وصول افزایشی ۳۰٪.
- Legacy payout compatibility.
- invoice sort date/amount/employee/store و pagination-after-sort.
- initial payment ISO boundary، allocation، invalid date و overpayment.
- invoice create/edit/reverse/delete، settlement date و manual item.
- order no-accounting-effect، convert exactly once و inventory effect once.
- note reminder dedup و auto-close پس از completion.
- alert storeName و auto-close.
- account delete/archive، product delete/archive و customer assignment pagination/backfill.

## K. Validation

- `npm test`: 42/42 passed (پس از آخرین اجرا در گزارش نهایی دوباره تأیید می‌شود).
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors؛ warningهای Hook/Image قدیمی جداگانه گزارش می‌شوند.
- `npm run build`: passed؛ هشدار نبود `DATABASE_URL` در محیط Build محلی مورد انتظار بود و Build را Fail نکرد.
- `npm audit --omit=dev`: 0 vulnerabilities.

