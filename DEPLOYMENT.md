# دليل النشر - MasrBounty

## نظرة عامة

هذا الدليل يغطي نشر MasrBounty على **Vercel** مع **Supabase** كمنصة خلفية.

## المتطلبات المسبقة

- حساب [Vercel](https://vercel.com)
- حساب [Supabase](https://supabase.com)
- حساب [GitHub](https://github.com)
- Node.js 20+ محلياً للاختبار

## 1. إعداد Supabase

### إنشاء مشروع جديد
1. اذهب إلى [supabase.com](https://supabase.com) وسجل دخول
2. اضغط **New Project**
3. اختر المنظمة، أدخل الاسم: `masrbounty`
4. اختر كلمة مرور قوية لقاعدة البيانات
5. اختر المنطقة الأقرب لمصر (مثل: `eu-west-1` Ireland)
6. اضغط **Create new project**

### تشغيل ملف SQL
1. في Dashboard المشروع، اذهب إلى **SQL Editor**
2. اضغط **New Query**
3. انسخ محتوى `supabase/masrbounty.sql` بالكامل
4. اضغط **Run** (قد يستغرق 1-2 دقيقة)
5. تحقق من عدم وجود أخطاء في Output

### إعداد Authentication
1. اذهب إلى **Authentication > Settings**
2. **Site URL**: `https://your-domain.com` (أو `http://localhost:3000` للتطوير)
3. **Redirect URLs**: أضف:
   - `https://your-domain.com/auth/callback`
   - `http://localhost:3000/auth/callback`
4. **Email Templates**: عدل القوالب للعربية
5. **Providers**: فعّل Email/Password و GitHub OAuth (اختياري)

### إعداد Storage
1. اذهب إلى **Storage**
2. تأكد من وجود الـ Buckets التالية (ينشئها ملف SQL):
   - `avatars` (Public)
   - `company-logos` (Public)
   - `report-attachments` (Private)
3. تحقق من سياسات RLS على كل Bucket

### الحصول على المفاتيح
1. اذهب إلى **Settings > API**
2. انسخ:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **سري جداً!**

## 2. إعداد GitHub

### إنشاء Repository
```bash
# محلياً
cd masrbounty
git init
git add .
git commit -m "feat: initial commit - MasrBounty platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/masrbounty.git
git push -u origin main
```

### إعداد GitHub Secrets
في Repository على GitHub:
1. اذهب إلى **Settings > Secrets and variables > Actions**
2. أضف **Repository Secrets** التالية:

| الاسم | القيمة | الوصف |
|--------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | مفتاح Supabase العام |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **مفتاح الخدمة - سري!** |
| `VERCEL_TOKEN` | `vc_...` | من Vercel Account Settings |
| `VERCEL_ORG_ID` | `team_...` | من Vercel Project Settings |
| `VERCEL_PROJECT_ID` | `prj_...` | من Vercel Project Settings |

### الحصول على Vercel Tokens
1. **VERCEL_TOKEN**: [Vercel Account Settings > Tokens](https://vercel.com/account/tokens) → Create
2. **VERCEL_ORG_ID** & **VERCEL_PROJECT_ID**: بعد ربط المشروع في Vercel (انظر أدناه)

## 3. النشر على Vercel

### الطريقة الأولى: Vercel Dashboard (أسهل)

1. اذهب إلى [vercel.com/new](https://vercel.com/new)
2. اختر **Import Git Repository**
3. اختر `masrbounty` من GitHub
4. **Framework Preset**: Next.js (يتعرف تلقائياً)
5. **Root Directory**: `./` (افتراضي)
6. أضف **Environment Variables**:

| الاسم | القيمة | البيئة |
|--------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Production فقط!** |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` | Production, Preview |
| `NEXT_PUBLIC_APP_NAME` | `MasrBounty` | جميع البيئات |
| `NODE_ENV` | `production` | Production فقط |

7. اضغط **Deploy**

### الطريقة الثانية: Vercel CLI

```bash
# تثبيت CLI
npm i -g vercel

# تسجيل دخول
vercel login

# نشر أولي (Preview)
vercel

# إعداد المشروع
vercel link

# متغيرات البيئة
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_APP_URL

# نشر للإنتاج
vercel --prod
```

### ربط GitHub مع Vercel (لـ GitHub Actions)
بعد النشر الأول:
1. في Vercel Project Settings > Git
2. تأكد من **Connected Git Repository** = `masrbounty`
3. انسخ **ORG ID** و **PROJECT ID** لـ GitHub Secrets

## 4. GitHub Actions CI/CD

### الملف: `.github/workflows/ci.yml`
ينفذ تلقائياً على كل Push/PR:
1. **Install** - `npm ci`
2. **Type Check** - `npm run typecheck`
3. **Lint** - `npm run lint`
4. **Test** - `npm run test`
5. **Build** - `npm run build`
6. **Deploy Preview** - على PRs (يتطلب Vercel Secrets)
7. **Deploy Production** - على الدمج لـ `main`

### التحقق من عمل CI
1. افتح PR جديد
2. راقب تبويب **Actions** في GitHub
3. يجب أن تنجح جميع الخطوات ✅

## 5. إعداد النطاق المخصص (Custom Domain)

### في Vercel
1. Project Settings > Domains
2. أضف `masrbounty.com` و `www.masrbounty.com`
3. اتبع تعليمات DNS:
   - **A Record**: `@` → `76.76.21.21`
   - **CNAME**: `www` → `cname.vercel-dns.com`
4. انتظر تفعيل SSL (تلقائي)

### تحديث Supabase
1. Authentication > Settings > Site URL → `https://masrbounty.com`
2. Redirect URLs → أضف `https://masrbounty.com/auth/callback`

### تحديث GitHub/Environment Variables
```env
NEXT_PUBLIC_APP_URL=https://masrbounty.com
```

## 6. مراقبة وصيانة الإنتاج

### Health Check Endpoint
```
GET https://masrbounty.com/api/health
```
يعيد: `{ "healthy": true, "checks": {...} }`

### سجلات Vercel
- Vercel Dashboard > Functions > Logs
- Real-time logs للـ Server Actions و API Routes

### سجلات Supabase
- Dashboard > Logs > Database / Auth / Storage / Edge Functions
- Queries البطيئة، أخطاء RLS، محاولات تسجيل دخول فاشلة

### النسخ الاحتياطي (Backups)
- **Supabase**: نسخ احتياطي يومي تلقائي (Point-in-time Recovery)
- **Database**: `pg_dump` أسبوعي للبيانات الحرجة (اختياري)
- **Code**: في GitHub (موزع)

### التحديثات
```bash
# تحديث التبعيات
npm update
npm run test
npm run build
git commit -am "chore: update dependencies"
git push

# تحديث Supabase (تلقائي)
# تحديث Vercel (تلقائي عند Push)
```

## 7. استكشاف الأخطاء (Troubleshooting)

### خطأ: "Module not found"
```bash
# محلياً
rm -rf node_modules .next
npm install
npm run build
```

### خطأ: "Supabase connection failed"
- تحقق من `NEXT_PUBLIC_SUPABASE_URL` و `ANON_KEY`
- تأكد من أن IP Vercel غير محظور في Supabase (مشروع مجاني = لا IP ثابت)

### خطأ: "RLS Policy violation"
- تحقق من سياسات RLS في `masrbounty.sql`
- تأكد من أن `auth.uid()` صحيح في Server Actions
- راجع `audit_logs` في قاعدة البيانات

### خطأ: "Build failed on Vercel"
- راجع Vercel Build Logs
- تأكد من `npm run build` ينجح محلياً
- تحقق من متغيرات البيئة في Vercel

### خطأ: "Function timeout"
- Server Actions لها حد 60 ثانية (Vercel Hobby) / 300 ثانية (Pro)
- للعمليات الطويلة: استخدم Edge Functions أو Background Jobs

## 8. قائمة تحقق ما قبل الإطلاق (Pre-launch Checklist)

### الأمان
- [ ] `SUPABASE_SERVICE_ROLE_KEY` فقط في Vercel Production Secrets
- [ ] RLS مفعل على جميع الجداول
- [ ] CSP Headers مضبوطة في `next.config.js`
- [ ] Rate Limiting على API Routes الحساسة
- [ ] File Upload Validation يعمل
- [ ] لا أسرار في الكود أو Git History

### الوظائف
- [ ] تسجيل دخول/خروج يعمل
- [ ] إنشاء برنامج (شركة)
- [ ] إنشاء تقرير (باحث)
- [ ] تriage وتعيين تقرير
- [ ] منح مكافأة
- [ ] طلب سحب
- [ ] رسائل ومحادثات
- [ ] إشعارات
- [ ] البحث
- [ ] RTL/LTR يعمل
- [ ] Dark/Light Mode يعمل

### الأداء
- [ ] `npm run build` ينجح بدون تحذيرات
- [ ] Lighthouse Score > 90
- [ ] Images محسنة
- [ ] Fonts محملة محلياً
- [ ] Database Indexes مضافة

### المراقبة
- [ ] Health Check endpoint يعمل
- [ ] Error Tracking معدود (Sentry/PostHog)
- [ ] Analytics معدود
- [ ] Uptime Monitoring (اختياري)

## 9. Rollback (التراجع)

### Vercel Rollback
1. Vercel Dashboard > Deployments
2. ابحث عن آخر نشر يعمل
3. اضغط **...** > **Promote to Production**

### Database Rollback
- Supabase > Settings > Database > Backups
- Point-in-time Recovery للوقت المطلوب
- **تحذير**: يفقد البيانات بين الوقتين

### Code Rollback
```bash
git revert <commit-hash>
git push origin main
# CI/CD سينشر تلقائياً
```

## 10. تكاليف تقديرية (شهرياً)

| الخدمة | الخطة المجانية | الخطة المدفوعة (التقدير) |
|---------|--------------|------------------------|
| Vercel | Hobby (مجاني) | Pro $20/شهر |
| Supabase | Free (500MB DB, 1GB Storage) | Pro $25/شهر |
| GitHub | Free (Public/Private) | Team $4/مستخدم/شهر |
| **المجموع** | **$0** | **~$49/شهر** |

---

**ملاحظة**: هذا الدليل للإصدار 1.0. راجع [CHANGELOG.md](CHANGELOG.md) للتحديثات المستقبلية.