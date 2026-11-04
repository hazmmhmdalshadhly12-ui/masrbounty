# MASRBOUNTY_AI_ACADEMY_IMPLEMENTATION_REPORT

**Branch:** `feature/ai-academy-reputation` (مبني على `feature/production-readiness-hardening` — لم يُدمج في main)
**Date:** 2026-11-04
**Commits:** 7 commits (4856b48 → 9cc308c) — كل نتيجة اختبار في هذا التقرير من أمر نُفّذ فعليًا في هذه الجلسة.

---

## 1. المميزات التي تم تنفيذها

### 1.1 البنية التحتية للذكاء الاصطناعي (المرحلة 1)
- خدمة AI مركزية على الخادم فقط (`lib/ai/`): لا يوجد أي مفتاح في الفرونت إند، ولا `NEXT_PUBLIC` لأي سر، وكل الطلبات تمر عبر Server-side.
- تعمل مع أي مزود متوافق مع واجهة OpenAI (`AI_API_BASE_URL` + `AI_API_KEY` + `AI_MODEL`) — بدون افتراض تطابق المزودين (client مكتوب بـ fetch مع مهلة زمنية 45 ثانية، محاولة إعادة واحدة على 429/5xx، وتصنيف أخطاء محدود لا يكشف المفتاح ولا رد المزود الخام).
- Rate Limiting مزدوج: حد انفجار بالدقيقة (in-memory) + حصص يومية وشهرية من قاعدة البيانات (`ai_usage_logs`) بفشل مغلق (fail-closed) عند تعذر التحقق من الحصة.
- تسجيل استهلاك كل طلب (مستخدم/ميزة/نموذج/tokens/زمن/نجاح) عبر Service Role — لا يستطيع المستخدم تزوير سجلات، ولا يرى سوى سجلاته.
- إعدادات إدارية كاملة (`ai_settings`): تفعيل/إيقاف، الحد اليومي لكل مستخدم، حد الدقيقة، الميزانية الشهرية، الميزات المسموحة، النموذج الافتراضي.
- إذا لم تكن أسرار Cloudflare موجودة: رسالة إعداد واضحة للأدمن في `/admin/ai`، والميزات تظهر «غير متاحة» للمستخدم — **الموقع لا يتعطل**.

### 1.2 AI Report Assistant (المرحلة 2)
- زر «مساعدة الذكاء الاصطناعي» في نموذج إنشاء التقرير مع 12 مهمة: تحسين العنوان/الملخص/الوصف، تنظيم خطوات الاستنساخ، تحسين الأثر والإصلاح، اقتراح الخطورة + CWE + CVSS استرشادي، مراجعة المعلومات الناقصة، تحسين اللغة، تحويل ملاحظات مبعثرة لتقرير، تلخيص للشركة، إخفاء البيانات الحساسة.
- واجهة مقارنة (النص الحالي ↔ المقترح) مع: **قبول / رفض / نسخ / تحسين جديد** + تعديل يدوي دائم.
- حماية من الأدلة المخترعة: قواعد صارمة في كل System Prompt (لا اختراع نتائج/PoC/استجابات HTTP/خطوات لم ينفذها الباحث) + الاقتراح **لا يُرسل تلقائيًا أبدًا** — القبول يملأ الحقل فقط ويبقى قابلًا للتعديل.
- اقتراح الخطورة وCWE استرشادي مع تحقق خادمي من صيغة CWE، وحقل CWE جديد في التقرير يُخزن في `reports.cwe`.

### 1.3 أكاديمية اختبار الاختراق (المرحلة 3)
- صفحة `/academy`: كتالوج بالبحث والتصنيف بالمستوى، شريط تقدم المستخدم، آخر الدورات، تنبيه أخلاقي ثابت.
- صفحة دورة `/academy/courses/[slug]`: قائمة الدروس بعلامات الإكمال، التسجيل/إلغاء التسجيل، نسبة الإنجاز، روابط الشهادات.
- صفحة درس `/academy/lessons/[id]`: أهداف التعلم، المحتوى، تضمين يوتيوب آمن (nocookie)، **اختبار قصير يُصحح على الخادم** (الإجابات الصحيحة لا تُرسل للمتصفح أبدًا)، تسجيل الإكمال، تنزيل المرفقات عبر Signed URL للمسجلين فقط، تنقل السابق/التالي.
- `/dashboard/learning`: الدورات المسجل بها ونِسَب الإنجاز وإحصاءات الاختبارات والشهادات — **كل التقدم في قاعدة البيانات وليس LocalStorage**.
- إدارة أدمن `/admin/academy`: إنشاء/تعديل/حذف دورة (الحذف للأدمن فقط)، بوابة نشر (لا نشر بدون درس منشور)، دروس CRUD، محرر اختبارات JSON بتحقق Zod، رفع PDF/صور إلى حاوية خاصة `academy-materials` مربوطة بمجلد الدورة، **مولّد دروس بالـAI** يحفظ مسودة غير منشورة بعلم `generated_by_ai` و**مراجعة إلزامية** قبل النشر.

### 1.4 السمعة والمستويات والشارات والشهادات (المرحلة 4)
- سمة السمعة أصبحت مبنية على أوزان قابلة للتعديل إداريًا (`platform_settings.reputation_weights`) بدل الأوزان الثابتة — المكرر وغير الصالح لا يمنحان نقاطًا.
- سجل سمعة **غير قابل للتعديل** (`reputation_events` + trigger منع UPDATE/DELETE): كل تغيير يُسجَّل مع السبب والمصدر.
- تعديل إداري للنقاط (خصم الإساءة/مكافأة) عبر RPC `adjust_reputation` للأدمن فقط مع سبب إلزامي وقيد ±500 + تدقيق.
- 6 مستويات باحث في قاعدة البيانات (`researcher_levels`) تُحتسب تلقائيًا: مبتدئ → موثّق (يتطلب توثيق هوية) → ماهر → متقدم → خبير (توثيق هوية) → نخبة (توثيق هوية) — مع دقيقة `min_accepted` وليس النقاط فقط. الأسماء والعتبات قابلة للتعديل من `/admin/reputation`.
- شارة «خريج الأكاديمية» تُمنح تلقائيًا مع شهادة إتمام دورة (نص صريح: شهادة تعليمية وليست اعتمادًا مهنيًا).
- شهادات قابلة للتحقق: رقم فريد `MB-CERT-XXXXXX`، إصدار تلقائي مرة واحدة عند إتمام 100% من دورة، إصدار إداري لشهادات إنجاز Bug Bounty بأساس موثق إلزامي، إلغاء للأدمن مع سبب.
- صفحة تحقق عامة `/certificates/[number]` تعرض: الرقم، اسم الحامل، الإنجاز، تاريخ الإصدار، الجهة (MasrBounty)، الحالة (صالحة/ملغاة) + **QR Code** — عبر RPC `verify_certificate` لا يكشف أي بيانات خاصة (لا معرفات ولا إيميلات).
- الشهادات تظهر في الملف العام للباحث وفي صفحة «التعلم».

### 1.5 حدود التقارير ومكافحة الإساءة (المرحلة 5)
- حد يومي + ساعي قابلان للتعديل (`platform_settings.report_limits`) مع استثناءات لكل مستخدم (`report_limit_overrides`: رفع لموثوق/خفض لمخالف مع سبب، للأدمن فقط).
- **الحد على الإرسال فقط** — حفظ المسودة وتعديل تقرير سابق غير محدودين أبدًا.
- تسجيل كل محاولة تجاوز في `suspicious_events` وعرضها في لوحة `/admin/report-limits` مع مراقب الإساءة.
- إبقاء الحد الحالي 10/ساعة على إنشاء المسودات كخط دفاع أول.

### 1.6 إصلاح إنشاء البرامج والتحقق من النطاقات (المرحلة 6 — الأولوية القصوى)
- `createVerificationTokenAction` لم يعد يرجع `null` صامتًا لكل الفشل — يرجع رسالة عربية **محددة** لكل حالة (صيغة دومين / انتهاء جلسة / لا يوجد ملف شركة / فشل قاعدة بيانات).
- تشخيص DNS دقيق بدل «فشل التحقق»: `NXDOMAIN` (الدومين غير موجود) مقابل «لا سجلات TXT» مقابل «يوجد سجل لكن القيمة غير مطابقة» (مع عرض القيمة المطلوبة) مقابل «تعذر الوصول لخدمات DNS» (Cloudflare+Google معًا).
- تشخيص فحص الملف دقيق: 404 (مع المسار المطلوب) / محتوى غير مطابق (مع عرض السطر المطلوب بالضبط) / الموقع لا يستجيب عبر HTTPS (تلميح SSL) / رموز HTTP أخرى.
- زر «إعادة الفحص» الصريح بعد أي فشل + توحيد الصرامة بين المسارين (القديم والجديد): مطابقة سطر-بسطر للملف، وقيمة DNS يجب أن تكون الجملة الموثقة (لا يُقبل token داخل نص عشوائي).
- استمرار الرمز بعد التحديث (موجود سابقًا) + تسجيل المحاولات في `domain_verification_attempts`.

### 1.7 لوحة الأدمن (المرحلة 9)
أضيفت أقسام: **الأكاديمية**، **الذكاء الاصطناعي** (إدارة + إحصائيات استهلاك + أحدث الطلبات)، **السمعة والشهادات** (تعديل/مستويات/إصدار/إلغاء)، **حدود التقارير** (حدود + استثناءات + إساءة). كل عملية إدارية تتحقق من الدور من الخادم (`requireStaff`/`requireAdminAction`) وقاعدة البيانات (RLS + RPC داخل الدوال) — لا اعتماد على إخفاء الأزرار.

### 1.8 الحفاظ على الموجود
- لم يُحذف أي ميزة؛ الهوية البصرية (shadcn/الخط/الألوان) محفوظة؛ العربية RTL + الإنجليزية كما هما؛ جميع إصلاحات أمان فرع `production-readiness-hardening` محفوظة (الفرع مبني فوقه مباشرة).

## 2. المميزات التي لم تكتمل (بصراحة)

| البند | الحالة | السبب |
|---|---|---|
| تنفيذ §19 فعليًا على Supabase | ⛔ يتطلب يدك | لا صلاحية لوصول لقاعدة البيانات من هنا — **شغّل الملف قبل النشر (§9 أدناه)** |
| اختبارات RLS حية متعددة الحسابات | ⛔ لم تُنفذ | لا يوجد مشروع Supabase تجريبي ببيانات اعتماد في هذه البيئة؛ الحزمة موجودة (`tests/integration/rls-live.test.ts` من الفرع الأساسي) وتعمل تلقائيًا عند توفير `RLS_TEST_*` |
| اختبارات E2E على خادم حي | ⛔ لم تُنفذ هنا | الـsandbox بلا بيانات اعتماد Supabase؛ الأوصاف الجديدة (`tests/e2e/academy.spec.ts`) ستعمل في CI/الاستضافة |
| مسارات تعليمية (Learning Paths) ككيان مستقل | جزئي | المستويات + الدورات موجودة؛ «مسار = مجموعة دورات» يمكن إضافتها لاحقًا بنفس النمط (الجدول مهيأ عبر `type: 'academy_path'` في الشهادات) |
| الدفع للدورات المدفوعة | مؤجل | الحقول (`is_free`/`price`) والبنية جاهزة، لكن ربطها بالمحفظة/Payments يحتاج قرار سعري منك |
| رفع فيديو مباشر إلى Storage | جزئي | الدرس يدعم رابط فيديو (YouTube/أي embed) + PDF/صور مرفوعة؛ رفع ملفات فيديو كبيرة يحتاج حدود حجم/زمن على Cloudflare |
| التحقق من النطاق في بيئة حية بعد النشر | ⏳ بعد النشر | الإصلاحات مكتملة بالكود والاختبارات الوحدية، لكن إعادة فحص DNS TXT لنطاقك الحقيقي تتم بعد Deploy (زر «إعادة الفحص») |

## 3. الملفات المعدلة (50 ملفًا: +6837 / −79)

**جديدة (35):**
- قاعدة بيانات: `supabase/migrations/19_ai_academy_reputation.sql`
- AI: `lib/ai/config.ts`، `lib/ai/client.ts`، `lib/ai/service.ts`، `features/ai/report-assistant.ts`، `features/ai/admin-actions.ts`
- الأكاديمية: `features/academy/services.ts`، `admin-actions.ts`، `quiz.ts`، `quiz-schema.ts`، `labels.ts`
- السمعة/الحدود: `features/reputation/admin-actions.ts`، `features/reports/limits.ts`
- صفحات عامة: `app/academy/page.tsx`، `app/academy/courses/[slug]/page.tsx`، `app/academy/lessons/[id]/page.tsx`، `app/certificates/[number]/page.tsx`
- صفحات مسجل: `app/dashboard/learning/page.tsx`
- أدمن: `app/admin/academy/page.tsx`، `app/admin/ai/page.tsx`، `app/admin/reputation/page.tsx`، `app/admin/report-limits/page.tsx`
- مكوّنات: `components/reports/ai-report-assistant.tsx`، `components/academy/{course-actions,lesson-body}.tsx`، `components/admin/{academy-manager,ai-admin,reputation-admin,report-limits-admin}.tsx`
- اختبارات: `tests/unit/{ai-client,report-limits,academy-quiz}.test.ts`، `tests/security/ai-academy-reputation-rls.test.ts`، `tests/e2e/academy.spec.ts`

**معدلة (15):** `supabase/masrbounty.sql`، `.env.example`، `package.json` (+qrcode)، `config/nav.ts`، `schemas/report.ts`، `features/reports/services.ts`، `components/reports/report-create-form.tsx`، `components/programs/program-builder/{actions.ts,steps/StepVerification.tsx}`، `lib/security/dns-txt.ts`، `services/verification.ts`، `app/admin/layout.tsx`، `app/dashboard/layout.tsx`، `components/layout/dashboard-shell.tsx`، `app/researchers/[username]/page.tsx`

## 4. الجداول الجديدة (كلها §19 — لا تكرار لأي جدول موجود)

فُحصت الـ62 جدولًا الموجودة أولًا؛ الجداول التالية **جديدة فعلاً** وتؤدي وظائف غير موجودة:

| الجدول | الوظيفة | RLS |
|---|---|---|
| `ai_settings` | إعدادات AI (صف واحد) | قراءة staff، تعديل admin |
| `ai_usage_logs` | سجل استهلاك AI | قراءة: صاحب السجل أو staff؛ **لا سياسات كتابة** (Service Role فقط) |
| `academy_courses` | الدورات | قراءة المنشور للجميع، كتابة staff |
| `academy_lessons` | الدروس + الاختبار (JSONB) + `generated_by_ai`/`ai_reviewed` | قراءة المنشور، كتابة staff |
| `academy_enrollments` | التسجيل | مالك الصف فقط |
| `academy_lesson_progress` | إكمال الدروس | مالك الصف فقط |
| `academy_quiz_attempts` | محاولات الاختبار | إدخال/قراءة المالك فقط + مسجل بالدورة |
| `certificates` | الشهادات القابلة للتحقق | قراءة المالك/staff، كتابة staff، حذف admin |
| `reputation_events` | سجل السمعة (append-only) | قراءة المالك/staff + **trigger يمنع UPDATE/DELETE** |
| `researcher_levels` | المستويات | قراءة عامة، كتابة admin |
| `report_limit_overrides` | استثناءات الحدود | كتابة admin |

+ حاوية تخزين خاصة: **`academy-materials`** (سياسات مربوطة بمجلد الدورة).
+ أعمدة جديدة: `reports.cwe`، `reports.cvss_vector`، `researcher_reputation.bonus_score`، `researcher_reputation.level_id`.

## 5. التعديلات على supabase/masrbounty.sql

أُضيف **القسم 19** (≈610 سطرًا) في نهاية الملف الرئيسي — الملف يبقى المصدر الوحيد، والقسم:
- **19.0** أعمدة جديدة (ALTER TABLE ... ADD COLUMN IF NOT EXISTS — آمن).
- **19.1–19.5** الجداول أعلاه + Seeds: 6 مستويات باحث، شارة `academy-graduate`، إعدادات `reputation_weights` و`report_limits` في `platform_settings`، صف `ai_settings`.
- **19.6** حاوية `academy-materials` + سياساتها.
- **19.7** دوال: `refresh_researcher_stats` (نسخة موسعة بأوزان قابلة للتعديل + bonus + مستوى + سجل)، `adjust_reputation` (admin)، `issue_achievement_certificate` (staff، أساس إلزامي)، `revoke_certificate` (staff)، `verify_certificate` (عام، آمن الخصوصية)، `academy_course_progress`، `issue_course_certificate` (تلقائي مرة واحدة عند 100%).
- **19.8–19.9** RLS لكل جدول جديد + Triggers (touch + حماية سجل السمعة).
- **Idempotent بالكامل**: `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` / `DROP POLICY IF EXISTS` — لا `DROP TABLE` ولا `TRUNCATE` ولا حذف بيانات (اختبار آلي يفحص ذلك).
- ملف ترقية مستقل مطابق: **`supabase/migrations/19_ai_academy_reputation.sql`**.

## 6. إعدادات Cloudflare المطلوبة

في **Cloudflare Pages → مشروعك → Settings → Environment variables** (Production + Preview):

| المتغير | القيمة | ملاحظة |
|---|---|---|
| `AI_API_KEY` | مفتاح مزود الـAI | **سر** — لا يُوضع أبدًا في الكود أو GitHub |
| `AI_API_BASE_URL` | مثل `https://api.openai.com/v1` | أي مزود متوافق مع OpenAI (المسار يشمل الإصدار) |
| `AI_MODEL` | مثل `gpt-4o-mini` | يجب أن يدعمه المزود |
| `AI_MAX_INPUT_CHARS` | `12000` (اختياري) | حد أحرف المدخلات لكل طلب |

الموجود مسبقًا لا يتغير: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`، `SUPABASE_SERVICE_ROLE_KEY` (ضروري الآن لتسجيل استخدام AI ورفع مواد الأكاديمية)، `SUPABASE_WEBHOOK_SECRET`.

## 7. طريقة إضافة AI API Key

1. احصل على مفتاح من مزود يدعم واجهة OpenAI (OpenAI / OpenRouter / Groq / Cloudflare AI Gateway…).
2. Cloudflare Pages → Settings → Environment variables → **Add variable**: الاسم `AI_API_KEY`، القيمة المفتاح، النوع **Secret (encrypted)**.
3. أضف `AI_API_BASE_URL` و`AI_MODEL` بنفس الطريقة.
4. **Deploy** جديد حتى تُقرأ المتغيرات (متغيرات البيئة لا تُطبق على النشر الجاري).
5. تحقق: `/admin/ai` — اختفِ تحذير «لم يتم إعداد المفتاح» .
6. للأمان: استخدم مفتاحًا محدود الحصة من جهة المزود أيضًا (دفاع في العمق ضد استنزاف الرصيد)، وبدّله فورًا إذا ظهر في أي مكان عام.

## 8. طريقة إعداد AI Model وBase URL

- الافتراضي إن تركت الحقول فارغة: `https://api.openai.com/v1` + `gpt-4o-mini`.
- لتغيير المزود: بدّل `AI_API_BASE_URL` (مثال OpenRouter: `https://openrouter.ai/api/v1`) و`AI_MODEL` — **بدون أي تعديل في الكود**.
- لتغيير النموذج لكل المنصة من داخل المنصة (بدون Deploy): `/admin/ai` → «النموذج الافتراضي» → حفظ (يُحفظ في `ai_settings.default_model` ويُقبل فقط إن كان ضمن قائمة المزود).
- لتقييد النماذج: عمود `allowed_models` في `ai_settings` (فارغ = بلا قيد).

## 9. طريقة تشغيل SQL

**قاعدة بيانات جديدة:** شغّل `supabase/masrbounty.sql` كاملًا في Supabase SQL Editor (يحتوي §19 تلقائيًا).
**قاعدة موجودة (إنتاجك الحالي):** شغّل **`supabase/migrations/19_ai_academy_reputation.sql`** مرة واحدة في SQL Editor — آمن لإعادة التشغيل، لا يحذف شيئًا، ويضيف الجداول/الأعمدة/الدوال/السياسات الجديدة فقط.
ملاحظة صراحة: لم أستطع تنفيذ أي SQL على قاعدة حقيقية من هذه البيئة — لذلك لا أدّعي أن إعادة تشغيل الملف الكامل على قاعدة قائمة «مثبتة بالاختبار»؛ لكن §19 مصمم idempotent وقد اختُبر static-ally بالكامل، ولديك ملف الترقية المستقل كمسار آمن لا يمس القديم.

## 10. طريقة اختبار التحقق من النطاق

1. أكمل ملف الشركة ثم افتح `/company/programs/new` → خطوة «إثبات الملكية».
2. **DNS TXT**: أنشئ الرمز → أضف سجل TXT عند مزوّدك: Host `_masrbounty.example.com` (أو `_masrbounty` فقط في بعض اللوحات) وValue `masrbounty-verification=<الرمز>`. إن فشل الفحص ستظهر لك **رسالة محددة بالسبب** (لا سجلات / قيمة خاطئة / NXDOMAIN / خلل DNS) + زر «إعادة فحص سجل DNS».
3. **ملف**: ارفع ملفًا باسم الرمز نفسه في جذر الموقع `https://example.com/<token>.txt` بمحتوى السطر `masrbounty-verification=<token>` بالضبط. عند الفشل ستعرف: 404؟ محتوى غير مطابق؟ الموقع لا يستجيب عبر HTTPS؟
4. تأكد أن الرمز يبقى بعد تحديث الصفحة (يُحفظ في `company_domains` ويُعاد استخدامه).
5. اختبار سلبي: جرب قيمة TXT خاطئة → يجب أن يفشل مع رسالة «القيمة غير مطابقة»، وجرب ملفًا يحتوي الرمز داخل نص عشوائي → يجب أن يفشل (مطابقة السطر بالضبط).
6. بعد النشر: من `/admin/verification` يمكن للإدارة مراجعة الحالات، والمحاولات مسجلة في `domain_verification_attempts`.

## 11. نتائج جميع الاختبارات (من أمر نُفّذ فعليًا)

| الأمر | النتيجة | التفصيل |
|---|---|---|
| `npx tsc --noEmit` | ✅ PASS | 0 errors |
| `npx eslint . --max-warnings=0` | ✅ PASS | 0 errors, 0 warnings |
| `npx jest` | ✅ PASS | **236 passed / 8 skipped / 0 failed** — منهم 44 اختبارًا جديدًا (AI client بدون تسريب مفتاح + حصص + حدود تقارير + تصحيح الاختبارات + 27 تأكيد أمني SQL على §19). الـ8 skipped = حزمة RLS الحية (بوابة صدق: لا بيانات اعتماد مشروع تجريبي) |
| `npm run build` | ✅ PASS | exit 0 — كل المسارات الجديدة صدرت (`/academy`, `/academy/courses/[slug]`, `/academy/lessons/[id]`, `/certificates/[number]`, `/dashboard/learning`, `/admin/{academy,ai,reputation,report-limits}`) |
| `npx next-on-pages` | ✅ PASS | Worker مولّد + 288+ أصلًا ثابتًا — متوافق مع Cloudflare Pages |
| `npm run test:e2e` (Playwright) | ⛔ لم يُنفذ هنا | لا بيانات اعتماد Supabase في الـsandbox — الأوصاف الجديدة جاهزة وتعمل في CI/الاستضافة (كما وثّق تقرير التصلب السابق: نتيجتها كانت 4/6 بنفس السبب) |

## 12. المشاكل المتبقية

1. **تشغيل §19 على قاعدة البيانات** — يدوي عليك (§9). حتى تنفيذه، صفحات الأكاديمية/الشهادات/الأدمن الجديدة سترجع أخطاء «relation does not exist».
2. **الحصة اليومية المعروضة للمستخدم تعتمد على `ai_usage_logs`** — أول تشغيل قبل تنفيذ §19 سيُعامل بمهلة «تعذر التحقق» (fail-closed) وهذا مقصود.
3. **Rate limiting بالذاكرة** يبقى حدًا ناعمًا على Cloudflare (isolates تُعاد تدويرها) — القيد الصلب هو حصص قاعدة البيانات؛ للحماية الشاملة أضف قاعدة WAF على `/api/*` (توصية قائمة من تقرير التصلب).
4. **CSP `unsafe-inline`** — قرار موثق من تصلب سابق (next-on-pages prerender)؛ لم يتغير.
5. **المحتوى المولّد بالـAI في الأكاديمية** يبقى مسؤولية المراجع البشري — البوابة (`ai_reviewed`) إلزامية بالكود، لكن جودة المحتوى نفسها تحتاج عينك.
6. **PAT الخاص بك ظهر مرارًا في المحادثة** — ألغِه وبدّله فورًا من GitHub Settings → Developer settings (تكرار تحذير سابق، ولم يُكتب في أي كود).

## 13. خطوات نشر Cloudflare

1. **Supabase أولاً**: شغّل `supabase/migrations/19_ai_academy_reputation.sql` في SQL Editor (§9).
2. **GitHub**: ارفع الفرع (تم من هذه الجلسة) وأنشئ Pull Request من `feature/ai-academy-reputation` ← راجع ثم ادمج في main يدويًا (لم أدمج تلقائيًا التزامًا بالقواعد).
3. **Cloudflare Pages**: Settings → Environment variables → أضف `AI_API_KEY` / `AI_API_BASE_URL` / `AI_MODEL` (Secret) للـ Production والـ Preview.
4. **Deploy** جديد (أو من PR في Pages المربوطة بالـGit سيتولد preview تلقائيًا).
5. **تحقق ما بعد النشر**: `/admin/ai` بلا تحذير إعداد → أنشئ دورة تجريبية + درس → انشرها → سجل باحث تجريبي → تسجيل في الدورة → إكمال الدروس → ظهور الشهادة → تحقق منها من `/certificates/<رقم>` عبر متصفح منفصل/موبايل.
6. **اختبار التحقق من النطاق** على دومينك الحقيقي (§10) بعد انتشار DNS.
7. عند ثبات كل شيء: راجع `reputation_weights` و`report_limits` من لوحات الأدمن لضبط الأرقام لسياسة المنصة.

---

## القواعد الإلزامية — حالة الالتزام

| القاعدة | الالتزام |
|---|---|
| لا إعادة بناء من الصفر | ✅ بناء فوق `feature/production-readiness-hardening` دون كسر أي شيء |
| لا حذف ميزات / لا تغيير الهوية البصرية | ✅ |
| RTL عربي + إنجليزي | ✅ كل الواجهات الجديدة عربية RTL مع `dir="ltr"` للحقول التقنية |
| لا بيانات وهمية / لا صفحات تجريبية ناقصة | ✅ كل شيء متصل بقاعدة البيانات والصلاحيات |
| لا أسرار في GitHub | ✅ لا مفتاح في الكود؛ `.env.example` أسماء فقط؛ الفرع نظيف من الأسرار |
| لا تعديل بيانات الإنتاج / لا SQL على الإنتاج | ✅ لم يُنفذ أي SQL على أي قاعدة |
| لا دمج تلقائي في main | ✅ الفرع مستقل |
| لا ادعاء اختبارات لم تُنفذ | ✅ §2 و§11 يوضحان ما لم يُنفذ ولماذا |
| لا جداول مكررة | ✅ فُحصت الـ62 جدولًا أولًا؛ 11 جدولًا جديدًا فقط بلا تكرار |

**الخلاصة:** كل الميزات المطلوبة منفذة في الكود والواجهة والقاعدة (§19) ومربوطة بالـBackend والصلاحيات، مع بوابات جودة خضراء كاملة. الخطوات المتبقية عليك: تشغيل SQL → إضافة أسرار Cloudflare → Deploy → مراجعة PR والدمج.
