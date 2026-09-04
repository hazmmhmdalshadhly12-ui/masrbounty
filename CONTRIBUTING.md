# دليل المساهمة في MasrBounty

شكراً لاهتمامك بالمساهمة في MasrBounty! نقدر كل مساهمة، سواء كانت إصلاح خطأ، إضافة ميزة، تحسين الوثائق، أو حتى اقتراح أفكار.

## 🚀 البداية السريعة

### 1. Fork و Clone
```bash
# Fork المستودع على GitHub ثم:
git clone https://github.com/YOUR_USERNAME/masrbounty.git
cd masrbounty
```

### 2. إعداد بيئة التطوير
```bash
# تثبيت التبعيات
npm install

# نسخ متغيرات البيئة
cp .env.example .env.local
# عدل .env.local وأضف بيانات Supabase الخاصة بك

# تشغيل قاعدة البيانات محلياً (اختياري - استخدم Supabase Cloud)
# supabase start

# تشغيل خادم التطوير
npm run dev
```

### 3. إنشاء فرع للعمل
```bash
git checkout -b feature/your-feature-name
# أو
git checkout -b fix/your-bug-fix
# أو
git checkout -b docs/your-documentation-update
```

## 📝 معايير الكود

### TypeScript
- استخدم **Strict Mode** دائماً
- تجنب `any` إلا عند الضرورة القصوى
- عرف الأنواع في `types/` أو بجانب المكون
- استخدم `type` بدلاً من `interface` للأنواع البسيطة
- فعّل `noUnusedLocals` و `noUnusedParameters`

### React / Next.js
- **Server Components** افتراضياً، `use client` فقط عند الحاجة
- مكونات صغيرة ومركزة (Single Responsibility)
- استخدم `React.memo`، `useMemo`، `useCallback` بحكمة
- Server Actions للتعديلات، API Routes للويب هوك
- Suspense للبيانات غير المتزامنة

### التنسيق (Prettier + ESLint)
```bash
# فحص التنسيق
npm run format:check

# تنسيق تلقائي
npm run format

# فحص ESLint
npm run lint
```

### CSS / Tailwind
- استخدم CSS Variables للثيم (Dark/Light/RTL)
- فئات Utility-first، تجنب CSS مخصص إلا عند الحاجة
- `clsx` أو `cn` للفئات الشرطية
- تصميم Mobile-first
- دعم RTL عبر `dir="rtl"` و Tailwind RTL variants

### التسمية
| النوع | النمط | مثال |
|--------|--------|-------|
| Components | PascalCase | `ReportCard.tsx` |
| Hooks | camelCase + use | `useReports.ts` |
| Utilities | camelCase | `formatCurrency.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Types/Interfaces | PascalCase | `ReportStatus` |
| Enums | PascalCase | `ReportStatus` |
| Files (non-component) | kebab-case | `report-utils.ts` |

## 🧪 الاختبارات

### مطلوب قبل PR
```bash
# جميع الاختبارات
npm run test

# فحص الأنواع
npm run typecheck

# فحص الكود
npm run lint

# البناء
npm run build
```

### أنواع الاختبارات المطلوبة
1. **Unit Tests**: للوظائف المنعزلة، Hooks، Schemas
2. **Integration Tests**: Server Actions، Database Operations
3. **Security Tests**: RLS Policies، Authorization Logic
4. **E2E Tests**: للمسارات الحرجة (تسجيل دخول، إنشاء تقرير، دفع مكافأة)

### تغطية الكود
- استهدف > 80% تغطية للكود الجديد
- اختبر الحالات الحدية والأخطاء
- استخدم `jest.mock` للتبعية الخارجية

## 🔒 الأمان

### قبل الإرسال
- [ ] لا توجد أسرار (Secrets) في الكود
- [ ] لا `SUPABASE_SERVICE_ROLE_KEY` في Client Components
- [ ] جميع المدخلات مُحققة بـ Zod
- [ ] RLS Policies محدثة للجداول الجديدة
- [ ] Audit Logs للإجراءات الحساسة

### الإبلاغ عن ثغرات أمنية
**لا تفتح Issue عام للثغرات الأمنية!**
راجع [SECURITY.md](SECURITY.md) للإبلاغ المسؤول.

## 📦 هيكل الـ Commits

نستخدم [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### الأنواع (Types)
| النوع | الاستخدام |
|--------|-----------|
| `feat` | ميزة جديدة |
| `fix` | إصلاح خطأ |
| `docs` | توثيق فقط |
| `style` | تنسيق، فواصل، إلخ (لا تغيير منطق) |
| `refactor` | إعادة هيكلة الكود |
| `perf` | تحسين أداء |
| `test` | إضافة/تعديل اختبارات |
| `chore` | مهام صيانة، تبعيات |
| `security` | إصلاحات أمنية |
| `ci` | إعدادات CI/CD |

### الأمثلة
```bash
feat(reports): add duplicate detection for reports
fix(auth): resolve session refresh race condition
docs(readme): update installation steps
refactor(wallet): extract transaction logic to service
test(reports): add unit tests for severity calculation
security(rls): fix policy bypass on report attachments
```

### Scope (النطاق)
استخدم اسم الميزة/المكون: `auth`, `reports`, `programs`, `wallet`, `messaging`, `notifications`, `badges`, `leaderboard`, `admin`, `company`, `ui`, `db`, `config`

## 🔀 Pull Request Process

### قبل فتح PR
- [ ] جميع الاختبارات تنجح محلياً
- [ ] `npm run typecheck` بدون أخطاء
- [ ] `npm run lint` بدون أخطاء
- [ ] `npm run build` ينجح
- [ ] الكود منسق بـ `npm run format`
- [ ] رسائل Commit تتبع المعايير
- [ ] تحديث الوثائق إن لزم

### قالب PR
```markdown
## الوصف
وصف مختصر للتغييرات.

## نوع التغيير
- [ ] إصلاح خطأ (Bug fix)
- [ ] ميزة جديدة (New feature)
- [ ] تغيير كاس (Breaking change)
- [ ] توثيق (Documentation)
- [ ] تحسين أداء (Performance)
- [ ] أمان (Security)

## الاختبارات
- [ ] اختبارات وحدة مضافة/محدثة
- [ ] اختبارات تكامل مضافة/محدثة
- [ ] اختبارات E2E مضافة/محدثة
- [ ] اختبرت يدوياً

## لقطات شاشة (إن وجد)
أضف لقطات شاشة للتغييرات البصرية.

## قائمة المراجعة
- [ ] الكود يتبع معايير المشروع
- [ ] مراجعة ذاتية للكود
- [ ] تعليقات للكود المعقد
- [ ] تحديث الوثائق
- [ ] لا توجد أخطاء في Console
- [ ] يعمل على Mobile و Desktop
- [ ] يدعم RTL و LTR
- [ ] يدعم Dark و Light Mode
```

### مراجعة الكود
- مطلوب موافقة **مراجع واحد على الأقل**
- جميع محادثات المراجعة يجب أن تُحل
- CI يجب أن ينجح (GitHub Actions)
- لا دمج مباشر لـ `main` - استخدم Squash and Merge

## 🏗 البنية المعمارية

### إضافة ميزة جديدة
1. **Types**: أضف الأنواع في `types/` أو `features/<feature>/types.ts`
2. **Schemas**: أضف Zod Schemas في `schemas/` أو `features/<feature>/schemas.ts`
3. **Services**: منطق الخادم في `services/` أو `features/<feature>/services.ts`
4. **Hooks**: منطق العميل في `hooks/` أو `features/<feature>/hooks/`
5. **Components**: مكونات UI في `components/` أو `features/<feature>/components/`
6. **Pages**: صفحات App Router في `app/`
6. **Database**: تحديث `supabase/masrbounty.sql` (Functions, Triggers, RLS)
7. **Tests**: أضف اختبارات في `tests/`

### قاعدة البيانات
- **لا تنشئ ملفات Migration منفصلة** - حدث `supabase/masrbounty.sql` مباشرة
- أضف الجداول في الترتيب الصحيح (Dependencies أولاً)
- كل جدول جديد يجب أن يكون له RLS Policies
- أضف Indexes للاستعلامات الشائعة
- وثق الدوال والمشغلات (Triggers) بتعليقات SQL

## 🌐 الترجمة (i18n)

### إضافة نصوص جديدة
1. أضف المفاتيح في `constants/translations/ar.json` و `en.json`
2. استخدم `useTranslation()` Hook
3. لا تضع نصوص عربية مباشرة في المكونات
4. دعم RTL/LTR تلقائي عبر `dir` attribute

## 📋 قائمة مراجعة الميزات الجديدة

### للميزات التي تضيف جداول قاعدة بيانات
- [ ] جدول مضاف لـ `masrbounty.sql`
- [ ] RLS Policies شاملة
- [ ] Indexes للأداء
- [ ] Foreign Keys مع `ON DELETE` مناسب
- [ ] Check Constraints للبيانات
- [ ] Triggers للتدقيق/التحديثات المشتقة
- [ ] Types محدثة في `types/supabase.ts` (شغل `npm run db:generate`)

### للميزات التي تضيف API/Server Actions
- [ ] Zod Schema للتحقق
- [ ] Authorization Check (RLS + Server-side)
- [ ] Error Handling موحد
- [ ] Audit Log للإجراءات الحساسة
- [ ] Rate Limiting (إن لزم)
- [ ] اختبارات تكامل

### للميزات التي تضيف Components
- [ ] الوصولية (Accessibility) - ARIA, Keyboard nav
- [ ] Responsive (Mobile, Tablet, Desktop)
- [ ] RTL Support
- [ ] Dark/Light Mode
- [ ] Loading, Error, Empty States
- [ ] Storybook/Documentation (إن أمكن)
- [ ] Unit Tests

## 🏷 إصدارات (Releases)

- نستخدم [Semantic Versioning](https://semver.org/)
- الإصدارات تُنشأ من خلال GitHub Actions عند الدمج لـ `main`
- Changelog يُحدث تلقائياً من Commits

## ❓ بحاجة للمساعدة؟

- افتح [GitHub Discussion](https://github.com/your-org/masrbounty/discussions) للأسئلة
- راجع [الوثائق](docs/) للتفاصيل التقنية
- تواصل مع الفريق عبر security@masrbounty.com

---

**شكراً لمساهمتك في بناء أفضل منصة Bug Bounty عربية! 🇪🇬**