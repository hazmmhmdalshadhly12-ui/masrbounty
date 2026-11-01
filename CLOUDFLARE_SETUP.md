# النشر على Cloudflare Pages

النشر بيتم تلقائيًا من GitHub Actions: كل push على `main` → الـ CI يشتغل →
لو كل الفحوصات نجحت، workflow اسمه **Deploy** يبني بـ `next-on-pages` وينشر على
Cloudflare Pages. الإعدادات (اسم المشروع + `nodejs_compat`) موجودة في `wrangler.toml`.

## 1. إعداد لمرة واحدة

1. سجّل في [dash.cloudflare.com](https://dash.cloudflare.com) (الخطة المجانية كافية).
2. **Account ID**: من الصفحة الرئيسية للحساب (أو Workers & Pages → الشريط الجانبي) انسخ `Account ID`.
3. **API Token**: My Profile → API Tokens → Create Token → Custom token:
   - Permissions: `Account` → `Cloudflare Pages` → `Edit`
   - Account Resources: حسابك
4. في GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. تأكد إن الأسرار دي موجودة (موجودة حاليًا): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` = `https://masrbounty.pages.dev` (أو دومينك).
   اختياري: `SUPABASE_WEBHOOK_SECRET`.

أول تشغيل للـ workflow بيعمل مشروع `masrbounty` على Cloudflare لوحده، وبينقل
`SUPABASE_SERVICE_ROLE_KEY` كسر للـ runtime.

## 2. تشغيل النشر

- تلقائي بعد كل CI ناجح على `main`.
- يدوي: **Actions → Deploy → Run workflow**.

## 3. بعد أول نشر

- في Supabase → Authentication → URL Configuration: حدّث **Site URL** و **Redirect URLs**
  (`https://masrbounty.pages.dev/**`).

## 4. دومين خاص (اختياري)

**Workers & Pages → masrbounty → Custom domains** → اتبع تعليمات DNS، وحدّث `NEXT_PUBLIC_APP_URL`.

## 5. ملاحظات تقنية

- كل الـ routes لازم تكون `runtime = 'edge'` (مطبق في `app/layout.tsx` والـ API routes).
- ممنوع استيراد `node:*` في كود السيرفر — استخدم `lib/security/edge-crypto.ts` و `lib/security/dns-txt.ts`.
- محليًا (Linux/macOS): `npm run pages:build` ثم `npm run pages:deploy` (يحتاج `wrangler login`).
