# النشر على Cloudflare Pages

المشروع `masrbounty` على Cloudflare Pages **مربوط بـ GitHub مباشرة**:

- كل push على `main` → Cloudflare يبني وينشر Production على
  **https://masrbounty.online** و https://masrbounty.pages.dev
- كل Pull Request → رابط Preview تلقائي (بيظهر كتعليق على الـ PR).
- أمر البناء: `npx @cloudflare/next-on-pages` — المخرجات: `.vercel/output/static`
  — الإعدادات (`nodejs_compat`) في `wrangler.toml`.

## 1. متغيرات البيئة (Cloudflare → masrbounty → Settings → Variables and Secrets)

- Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (= `https://masrbounty.online`).
- Preview: نفس المتغيرات (لكن يُفضّل مشروع Supabase تجريبي) — من غيرها صفحات الـ Preview
  اللي بتقرا من قاعدة البيانات بتعرض رسالة خطأ.

## 2. Supabase

Authentication → URL Configuration: **Site URL** = `https://masrbounty.online`،
و **Redirect URLs** تشمل `https://masrbounty.online/**` و `https://*.masrbounty.pages.dev/**`.

## 3. نشر يدوي (احتياطي)

GitHub → **Actions → Deploy → Run workflow** (يحتاج أسرار `CLOUDFLARE_API_TOKEN`
و `CLOUDFLARE_ACCOUNT_ID` في GitHub — موجودين). أو محليًا: `npm run pages:build && npm run pages:deploy`.

## 4. ملاحظات تقنية

- كل الـ routes لازم تكون `runtime = 'edge'` (مطبق في `app/layout.tsx` والـ API routes).
- ممنوع استيراد `node:*` في كود السيرفر — استخدم `lib/security/edge-crypto.ts` و `lib/security/dns-txt.ts`.
- محليًا (Linux/macOS): `npm run pages:build` ثم `npm run pages:deploy` (يحتاج `wrangler login`).
