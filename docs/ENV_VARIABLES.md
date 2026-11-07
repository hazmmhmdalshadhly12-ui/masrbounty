# Environment Variables — متغيرات البيئة

> كل القيم الحسّاسة تُضبط في `.env.local` (محليًا) وفي **Cloudflare Pages → Settings → Environment variables** (للإنتاج). لا تُرفع على GitHub أبدًا.

## 1. نظام المحفظة الذكية والنظام القانوني (هذا الفرع)

**لا يضيف هذا الفرع أي متغيّر بيئة جديد.** كل الإعدادات الجديدة تُدار من قاعدة البيانات:

- نسبة العمولة → جدول `commission_settings` (تُضبط من `/admin/finance`؛ تُزرع أولية 20% عبر الترحيل 24).
- وثائق السياسات وإصداراتها وإعادة الموافقة → جداول `legal_*` (تُدار من `/admin/legal`).

لا مفاتيح دفع، ولا أسرار تخزين، ولا أي قيمة سرية جديدة مطلوبة.

## 2. المطلوبة للتشغيل (Supabase)

| المتغير | السري؟ | الوصف |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | لا | عنوان مشروع Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | لا* | مفتاح anon (محمي بـ RLS؛ *لا يُعتبر سرًا لكن لا يُعبث به). |
| `SUPABASE_SERVICE_ROLE_KEY` | **نعم — سري للغاية** | يُستخدم فقط على السيرفر (`lib/supabase/admin.ts`) لتجاوز RLS في تدقيق/الإدارة. تسريبه = وصول كامل للقاعدة. |

## 3. التطبيق والمصادقة

| المتغير | الوصف |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | عنوان الموقع الأساسي (يُطبَّع عبر `lib/site-url.ts`). |
| `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_DESCRIPTION` | هوية التطبيق. |
| `NEXT_PUBLIC_AUTH_REDIRECT_URL` | رابط إعادة التوجيه بعد المصادقة. |

## 4. الذكاء الاصطناعي (موجود مسبقًا — غير متغير في هذا الفرع)

| المتغير | السري؟ | الوصف |
| --- | --- | --- |
| `AI_API_KEY` | **نعم** | مفتاح المزوّد المتوافق مع OpenAI. **يُمنع** وضع `NEXT_PUBLIC_` قبل الاسم. |
| `AI_API_BASE_URL` | لا | يتضمن مسار الإصدار (مثل `https://api.openai.com/v1`). |
| `AI_MODEL` | لا | النموذج الافتراضي (الاختيار الإداري له الأسبقية عبر `resolveEffectiveAiModel`). |
| `AI_MAX_INPUT_CHARS` | لا | حد أقصى لحجم نص الطلب (ضد الإساءة). |

## 5. Webhooks والأمان

| المتغير | السري؟ | الوصف |
| --- | --- | --- |
| `SUPABASE_WEBHOOK_SECRET` | **نعم** | مقارنة timing-safe لويبهوك Supabase → `/api/webhooks/supabase`. |

## 6. اختيارية

- `NEXT_PUBLIC_ENABLE_RTL` / `NEXT_PUBLIC_DEFAULT_LOCALE` / `NEXT_PUBLIC_ENABLE_DARK_MODE` — تفضيلات الواجهة (افتراضي: RTL عربي).
- `SMTP_*` / `EMAIL_FROM` — البريد (اختياري؛ التسجيل يعتمد رابط تأكيد Supabase).
- `UPSTASH_REDIS_REST_URL/TOKEN` — لتحويل حدود المعدل إلى Redis عند تعدد النسخ.
- `NEXT_PUBLIC_POSTHOG_*` — تحليلات.

## 7. قواعد ذهبية

1. **أبداً** لا يُرفع `.env.local` أو أي قيمة سرية إلى المستودع — يوجد `.env.example` كمرجع أسماء فقط.
2. أي مفتاح ظهر في سجل/لقطة شاشة يُعد مكشوفًا ويُدوَّر فورًا من مزوّده.
3. المتغيرات ذات البادئة `NEXT_PUBLIC_` تُضمَّن في حزمة المتصفح — لا تضع فيها أي سر إطلاقًا.
4. في Cloudflare Pages تُضبط نفس المتغيرات لبيئة Production وPreview معًا.
