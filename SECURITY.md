# سياسة الأمان - MasrBounty

نحن نأخذ أمان منصة MasrBounty على محمل الجد. إذا اكتشفت ثغرة أمنية، نقدر إبلاغك لنا بمسؤولية.

## 🚨 الإبلاغ عن ثغرة أمنية

**لا تفتح Issue عام على GitHub للثغرات الأمنية!**

بدلاً من ذلك، يرجى الإبلاغ عبر أحد القنوات التالية:

### القناة الأساسية
**البريد الإلكتروني**: security@masrbounty.com

### معلومات مطلوبة في التقرير
يرجى تضمين المعلومات التالية:
- وصف واضح للثغرة
- خطوات إعادة الإنتاج (Step-by-step)
- التأثير المحتمل (Impact)
- أي Proof of Concept (اختياري)
- بيئة الاختبار (Browser, OS, Version)
- هل الثغرة قابلة للاستغلال عن بعد أم تتطلب صلاحيات؟

### وقت الاستجابة
- **تأكيد الاستلام**: خلال 48 ساعة
- **التقييم الأولي**: خلال 5 أيام عمل
- **التحديثات الدورية**: كل أسبوع حتى الإصلاح
- **الإصلاح والنشر**: حسب الخطورة (Critical: 72 ساعة، High: أسبوع، Medium: أسبوعان، Low: شهر)

## 🏷 تصنيف الخطورة

نستخدم [CVSS 4.0](https://www.first.org/cvss/v4.0/) لتقييم الخطورة:

| المستوى | الوصف | وقت الإصلاح المستهدف |
|----------|---------|---------------------|
| **Critical** | تنفيذ كود عن بعد، تسريب بيانات حساسة، تجاوز مصادقة | 72 ساعة |
| **High** | ثغرات تصعيد صلاحيات، حقن SQL، XSS مخزن | أسبوع واحد |
| **Medium** | CSRF، معلومات مكشوفة، منطقية أعمال | أسبوعان |
| **Low** | مشاكل UI، تسريب معلومات ثانوي | شهر واحد |

## 🛡 ممارسات الأمان في MasrBounty

### المصادقة والتخويل
- **Supabase Auth** مع JWT آمن
- **Row Level Security (RLS)** على جميع الجداول
- **Server-side Authorization** في جميع Server Actions
- **No Client-side Authorization Only** - أبداً
- **Session Management** آمنة مع HttpOnly Cookies

### حماية البيانات
- **تشفير TLS 1.3** لجميع الاتصالات
- **تشفير قاعدة البيانات** في وضع السكون (Supabase managed)
- **ملفات مرفقات خاصة** - Private Storage Buckets
- **لا أسرار في الكود العميل** - Service Role Key على الخادم فقط
- **Audit Logging** لجميع الإجراءات الحساسة

### حماية التطبيق
- **Content Security Policy (CSP)** صارمة
- **Security Headers** (X-Frame-Options, X-Content-Type-Options, إلخ)
- **Rate Limiting** على API endpoints الحساسة
- **Input Validation** بـ Zod على جميع المدخلات
- **File Upload Validation** (نوع، حجم، مسح)
- **XSS Protection** عبر React Auto-escaping + CSP
- **CSRF Protection** عبر SameSite Cookies + Origin Check

### البنية التحتية
- **Supabase Managed PostgreSQL** مع تحديثات أمنية تلقائية
- **Vercel Edge Network** مع DDoS Protection
- **GitHub Dependabot** لتحديث التبعيات
- **Secrets Management** عبر Vercel/Supabase Dashboard
- **لا Secrets في Repository** - أبداً

## 🔍 نطاق برنامج Bug Bounty

### في النطاق (In Scope)
- `masrbounty.com` وجميع النطاقات الفرعية
- API endpoints (`/api/*`, Server Actions)
- نظام المصادقة والتخويل
- نظام التقارير والمكافآت
- نظام المحفظة والمدفوعات
- نظام الرسائل والإشعارات
- لوحة التحكم (Researcher, Company, Admin)

### خارج النطاق (Out of Scope)
- هجمات الهندسة الاجتماعية على الموظفين
- هجمات الحرمان من الخدمة (DoS/DDoS)
- الثغرات في خدمات طرف ثالث (Supabase, Vercel, إلخ) - أبلغهم مباشرة
- مشاكل لا تؤثر على أمان المستخدمين/البيانات
- تقارير تلقائية من أدوات الفحص دون تحقق يدوي
- ثغرات تتطلب وصول فيزيائي للجهاز

### مكافآت برنامج Bug Bounty الداخلي
بصفنا منصة Bug Bounty، نمارس ما نعظ به:

| الخطورة | المكافأة (USD) | ملاحظات |
|----------|---------------|---------|
| Critical | $500 - $2,000 | حسب التأثير |
| High | $200 - $500 | |
| Medium | $50 - $200 | |
| Low | $25 - $50 | |

*المكافآت تدفع بعد التحقق والإصلاح، عبر محفظة MasrBounty أو تحويل بنكي.*

## 📋 الإبلاغ المسؤول (Responsible Disclosure)

### ما نطلبه منك
1. **لا تصل لبيانات مستخدمين آخرين** - استخدم حسابات اختبار فقط
2. **لا تصلح أو تعدل بيانات** - وثق فقط
3. **لا تشارك الثغرة** قبل إصلاحها ونشرها
4. **أعطنا وقتاً معقولاً** للإصلاح قبل النشر العام
5. **لا تنتهك قوانين** بلدك أو مصر

### ما نعدك به
1. **لا إجراءات قانونية** ضد الباحثين الذين يتبعون هذه السياسة
2. **اعتراف عام** في Hall of Fame (بإذنك)
3. **مكافأة عادلة** حسب الخطورة
4. **تحديثات دورية** عن حالة الإصلاح
5. **تنسيق للنشر المشترك** بعد الإصلاح

## 🔐 أمان مفاتيح API والبيانات

### متغيرات البيئة الحساسة
**لا تلتزم أبداً** بالملفات التالية:
- `.env.local`
- `.env.production.local`
- أي ملف يحتوي على `SUPABASE_SERVICE_ROLE_KEY`
- مفاتيح Stripe, SendGrid, إلخ

### في GitHub Actions
- استخدم **GitHub Secrets** للمتغيرات الحساسة
- `SUPABASE_SERVICE_ROLE_KEY` فقط في بيئة `production`
- مفاتيح النشر (Vercel Token) في Secrets

### في الكود
```typescript
// ❌ خطأ - في Client Component
const supabase = createClient(url, serviceRoleKey)

// ✅ صحيح - في Server Action / API Route / Server Component
const supabase = createServerClient() // يستخدم Service Role Key من env
```

## 📦 تحديثات الأمان للتبعيات

- **Dependabot** مفعل للتحديثات التلقائية
- **npm audit** يشغل في CI لكل PR
- التبعيات الحرجة تحدث خلال 48 ساعة
- راجع `package-lock.json` قبل الدمج

## 📞 جهات الاتصال الأمنية

| الغرض | الاتصال |
|--------|---------|
| تقارير الثغرات | security@masrbounty.com |
| طوارئ أمنية | security@masrbounty.com (عنوان طوارئ) |
| أسئلة أمان عامة | GitHub Discussions #security |
| توثيق الأمان | صفحة `/security` داخل المنصة |

## 📄 التحديثات

هذه السياسة تُحدث دورياً. آخر تحديث: **2024-01-15**

الإصدار الحالي: **1.0**

---

**MasrBounty Team** - الأمن أولاً، دائماً 🇪🇬