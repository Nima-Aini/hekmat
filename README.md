# سیستم مدیریت یکپارچه حکمت آکما

## راه‌اندازی روی Render.com (رایگان)

### مرحله ۱: دیتابیس رایگان بساز

۱. به **neon.tech** برو → Sign Up → Create Project (اسم: akmamath)
۲. بعد از ساخت، روی **Connection string** کلیک کن
۳. حالت **Pooled connection** رو انتخاب کن → کپی کن

### مرحله ۲: کد رو آپلود کن

۱. به **github.com** برو → New Repository → اسم: akmamath
۲. فایل‌های داخل این ZIP رو آپلود کن (Drag & Drop)
۳. Commit changes رو بزن

### مرحله ۳: روی Render.com Deploy کن

۱. به **render.com** برو → Sign Up → New Web Service
۲. Connect to GitHub → Repo: akmamath رو انتخاب کن
۳. تنظیمات:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
4. در بخش **Environment Variables** اضافه کن:
   - Key: `DATABASE_URL` → Value: اون connection string که از Neon کپی کردی
5. Create Web Service رو بزن

### بعد از Deploy

سایت بالا میاد و **به صورت خودکار** جداول دیتابیس رو می‌سازه و داده‌های نمونه اضافه می‌کنه.

## متغیرهای محیطی

| متغیر | توضیح | اجباری |
|-------|-------|--------|
| `DATABASE_URL` | آدرس Neon PostgreSQL | بله |
| `OPENAI_API_KEY` | کلید AI (اختیاری) | خیر |


## Admin login (first deploy)

Set `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` in `.env`. Defaults for a test environment are `akmaadmin` / `AkmaAdmin@2026`; change them before production.

## Google Maps

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Enable Maps JavaScript API and Places API/Places Library in Google Cloud.
