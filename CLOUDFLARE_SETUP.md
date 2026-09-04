# النشر على Cloudflare Pages (مجاني)

Cloudflare Pages يستضيف Next.js الديناميكي (Server Actions + Middleware + API)
عبر أداة `next-on-pages`. الخطة المجانية كافية للانطلاق ولا تطلب فيزا.

## 1. إنشاء المشروع (مرة واحدة)

1. سجّل في [dash.cloudflare.com](https://dash.cloudflare.com) (مجاني)
2. **Workers & Pages → Create → Pages → Connect to Git**
3. اختر حساب GitHub ومستودع `masrbounty`
4. إعدادات البناء:
   - **Framework preset**: Next.js
   - **Build command**: `npx @cloudflare/next-on-pages`
   - **Build output directory**: `.vercel/output/static`
5. **Environment variables** (نفس قيم Supabase):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (سري — Production فقط)
   - `NEXT_PUBLIC_APP_URL` = رابط المشروع (مثل `https://masrbounty.pages.dev`)
6. **Save and Deploy** — أول نشر يتم تلقائيًا

## 2. Compatibility flags (مهم)

**Pages project → Settings → Functions → Compatibility flags** → أضف للـ Production والـ Preview:
```
nodejs_compat
```
بدونها يفشل تشغيل Next.js على Workers.

## 3. بعد النشر

- كل `git push` على `main` يعيد النشر تلقائيًا ✅
- كل Pull Request يأخذ رابط Preview للتجربة ✅
- في Supabase حدّث **Site URL** و **Redirect URLs** (`https://xxx.pages.dev/auth/callback`)

## 4. دومين خاص (اختياري)

**Pages project → Custom domains → Set up a custom domain** → اتبع تعليمات DNS.
الدومين نفسه يُشترى من أي مسجل (~$10-15/سنة) — الاستضافة على Cloudflare تبقى مجانية.

## 5. ملاحظات تقنية

- البناء السحابي يُفحص تلقائيًا في CI عبر job اسمه `cloudflare`
- أداة `next-on-pages` لا تعمل على Windows محليًا — طوّر بـ `npm run dev` محليًا ودع البناء السحابي لـ CI/Cloudflare
- أوامر مفيدة:
  ```bash
  npm run pages:build    # بناء Cloudflare (Linux/macOS فقط)
  npm run pages:deploy   # نشر يدوي عبر wrangler (يحتاج تسجيل دخول)
  ```
