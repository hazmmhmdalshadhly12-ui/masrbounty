# MasrBounty

[![Next.js](https://img.shields.io/badge/Next.js-14.1.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39.7-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

منصة **Bug Bounty** مصرية احترافية مستوحاة من HackerOne، مبنية بهوية وتصميم وتجربة مستخدم مصرية مستقلة.

## 🎯 المميزات

### للباحثين الأمنيين (Researchers)
- **لوحة تحكم شاملة**: تقاريري، الأرباح، السمعة، الشارات، البرامج المحفوظة
- **نظام تقارير متقدم**: إنشاء، تتبع، وإدارة تقارير الثغرات الأمنية
- **محفظ مالية**: رصيد، أرباح معلقة، سجل المعاملات، طلبات السحب
- **نظام السمعة والراتب**: نقاط السمعة، الرتب، لوحة المتصدرين، قاعة المشاهير
- **الشارات والإنجازات**: First Blood، Critical Hunter، Top Researcher، وغيرها
- **الرسائل والإشعارات**: تواصل مباشر مع الشركات والفريق

### للشركات (Companies)
- **إدارة البرامج**: إنشاء برامج عامة/خاصة، الأصول، القواعد، نطاقات المكافآت
- **إدارة التقارير**: تriage، تعيين، تقييم، مكافأة، حل
- **فريق العمل**: دعوة أعضاء، أدوار وصلاحيات مفصلة
- **التحليلات**: إحصائيات البرامج، التقارير، الأداء
- **المدفوعات**: موافقة يدوية على المكافآت، سجل المدفوعات

### للمسؤولين (Admins & Moderators)
- **إدارة المستخدمين**: باحثين، شركات، فرق
- **الإشراف**: نزاعات، تقارير مشبوهة، إجراءات إشرافية
- **سجلات التدقيق**: تتبع جميع الإجراءات الحساسة
- **إعدادات المنصة**: تكوين عام، سياسات، ثوابت
- **الأمان**: أحداث أمنية، مراقبة، تقارير

## 🛠 التقنيات المستخدمة

### Frontend
- **Next.js 14** (App Router, Server Components, Server Actions)
- **TypeScript 5** (Strict mode, مسارات مطلقة)
- **React 18** (Hooks, Suspense, Concurrent Features)
- **Tailwind CSS 3** (CSS Variables, Dark Mode, RTL Support)
- **shadcn/ui** (Radix UI Primitives, مكونات قابلة للتخصيص)
- **Lucide React** (أيقونات حديثة)
- **Recharts** (رسوم بيانية تفاعلية)
- **React Hook Form + Zod** (نماذج مع التحقق)
- **TanStack Query** (إدارة حالة الخادم، التخزين المؤقت)
- **Framer Motion** (رسوم متحركة سلسة)
- **Zustand** (إدارة حالة العميل البسيطة)

### Backend & Database
- **Supabase** (Auth, Database, Storage, Realtime, Edge Functions)
- **PostgreSQL 15+** (RLS, Functions, Triggers, Views, Indexes)
- **Row Level Security** (سياسات أمان على مستوى الصفوف)
- **PostgreSQL Functions** (منطق أعمال معقد في قاعدة البيانات)
- **Database Triggers** (أتمتة، تدقيق، تحديثات مشتقة)

### DevOps & Quality
- **ESLint + Prettier** (تنسيق وفحص الكود)
- **Husky + lint-staged** (Git Hooks)
- **Jest + React Testing Library** (اختبارات وحدة وتكامل)
- **Playwright** (اختبارات E2E)
- **GitHub Actions** (CI/CD Pipeline)
- **Vercel** (نشر سلس مع معاينة)

## 📁 هيكل المشروع

```
masrbounty/
├── app/                    # Next.js App Router Pages
│   ├── (auth)/            # مجموعة المسارات للمصادقة
│   ├── (dashboard)/       # لوحة التحكم (Researcher/Company)
│   ├── (admin)/           # لوحة الإدارة
│   ├── (public)/          # الصفحات العامة
│   ├── api/               # API Routes & Server Actions
│   └── globals.css        # الأنماط العامة + CSS Variables
├── components/             # مكونات UI مشتركة
│   ├── ui/                # مكونات shadcn/ui الأساسية
│   ├── forms/             # مكونات النماذج
│   ├── layout/            # مكونات التخطيط (Header, Sidebar, Footer)
│   ├── dashboard/         # مكونات لوحة التحكم
│   ├── reports/           # مكونات التقارير
│   ├── programs/          # مكونات البرامج
│   ├── wallet/            # مكونات المحفظة
│   ├── messaging/         # مكونات الرسائل
│   ├── notifications/     # مكونات الإشعارات
│   ├── badges/            # مكونات الشارات
│   ├── charts/            # مكونات الرسوم البيانية
│   ├── tables/            # مكونات الجداول
│   ├── modals/            # النوافذ المنبثقة
│   ├── drawers/           # الأدراج الجانبية
│   ├── dropdowns/         # القوائم المنسدلة
│   ├── toasts/            # الإشعارات المنبثقة
│   ├── loaders/           # حالات التحميل
│   ├── skeletons/         # الهياكل الوهمية
│   ├── empty-states/      # الحالات الفارغة
│   └── error-states/      # حالات الخطأ
├── features/               # وحدات الميزات (Feature-based architecture)
│   ├── auth/              # المصادقة والصلاحيات
│   ├── programs/          # برامج Bug Bounty
│   ├── reports/           # التقارير والثغرات
│   ├── wallet/            # المحفظة والمعاملات
│   ├── messaging/         # الرسائل والمحادثات
│   ├── notifications/     # الإشعارات
│   ├── reputation/        # السمعة والراتب
│   ├── badges/            # الشارات والإنجازات
│   ├── leaderboard/       # لوحة المتصدرين
│   ├── hall-of-fame/      # قاعة المشاهير
│   ├── search/            # البحث
│   ├── admin/             # ميزات الإدارة
│   └── company/           # ميزات الشركات
├── hooks/                  # Custom React Hooks
├── lib/                    # مكتبات وأدوات مساعدة
├── services/               # خدمات lato الخادم (Server-side)
├── schemas/                # مخططات التحقق (Zod)
├── types/                  # تعريفات TypeScript
├── utils/                  # دوال مساعدة
├── constants/              # الثوابت والتعدادات
├── config/                 # ملفات التكوين
├── public/                 # الملفات الثابتة
├── tests/                  # الاختبارات
│   ├── unit/              # اختبارات الوحدة
│   ├── integration/       # اختبارات التكامل
│   ├── security/          # اختبارات الأمان
│   └── e2e/               # اختبارات E2E
├── docs/                   # الوثائق
├── supabase/               # ملفات Supabase
│   └── masrbounty.sql     # ملف SQL الرئيسي (50+ جدول)
├── .github/
│   └── workflows/         # GitHub Actions CI/CD
└── ملفات التكوين الجذرية
```

## 🚀 البدء السريع

### المتطلبات المسبقة
- Node.js 20+
- npm 10+
- حساب Supabase
- Git

### التثبيت

```bash
# استنساخ المستودع
git clone https://github.com/your-username/masrbounty.git
cd masrbounty

# تثبيت التبعيات
npm install

# نسخ متغيرات البيئة
cp .env.example .env.local

# تعديل .env.local وإضافة بيانات Supabase الخاصة بك
# NEXT_PUBLIC_SUPABASE_URL=your-project-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### إعداد قاعدة البيانات

1. أنشئ مشروع جديد في [Supabase](https://supabase.com)
2. اذهب إلى **SQL Editor**
3. انسخ محتوى `supabase/masrbounty.sql` والصقه هناك
4. اضغط **Run** لتنفيذ الملف كاملاً
5. سيقوم بإنشاء:
   - 50+ جداول مع العلاقات
   - Enums, Indexes, Foreign Keys
   - Functions & Triggers
   - Views
   - Row Level Security Policies
   - Storage Buckets Configuration
   - Development Seed Data

### تشغيل محلياً

```bash
# وضع التطوير
npm run dev

# سيفتح على http://localhost:3000
```

### أوامر التطوير

```bash
# فحص الأنواع
npm run typecheck

# فحص الكود
npm run lint

# تنسيق الكود
npm run format

# البناء للإنتاج
npm run build

# تشغيل النسخة المبنية
npm start

# تشغيل الاختبارات
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
```

## 🔐 متغيرات البيئة

| المتغير | مطلوب | الوصف |
|-----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | نعم | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | نعم | مفتاح Supabase العام (Anon Key) |
| `SUPABASE_SERVICE_ROLE_KEY` | نعم | مفتاح الخدمة (Server-side فقط!) |
| `NEXT_PUBLIC_APP_URL` | نعم | رابط التطبيق (للإعادة التوجيه) |
| `NEXT_PUBLIC_APP_NAME` | لا | اسم التطبيق |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | لا | اللغة الافتراضية (ar/en) |

> ⚠️ **تنبيه أمني**: لا تضع أبداً `SUPABASE_SERVICE_ROLE_KEY` في الكود العميل (Client Components). استخدمه فقط في Server Actions، API Routes، أو Server Components.

## 🗄 قاعدة البيانات

ملف SQL واحد شامل: `supabase/masrbounty.sql`

### الجداول الرئيسية (50+ جدول)

**المستخدمين والأدوار:**
- `profiles` - الملفات الشخصية الموحدة
- `user_roles` - أدوار المستخدمين (researcher, company, admin, moderator)
- `researcher_profiles` - ملفات الباحثين الموسعة
- `company_profiles` - ملفات الشركات
- `company_members` - أعضاء فرق الشركات
- `company_invitations` - دعوات الانضمام للفرق
- `company_verifications` - توثيق الشركات

**البرامج والأصول:**
- `programs` - برامج Bug Bounty
- `program_assets` - الأصول المشمولة (نطاق الاختبار)
- `program_rules` - قواعد البرنامج
- `program_researchers` - باحثون مدعوون للبرامج الخاصة
- `saved_programs` - برامج محفوظة من قبل الباحثين
- `researcher_program_activity` - نشاط الباحث في البرامج

**التقارير:**
- `reports` - تقارير الثغرات (MB-000001 format)
- `report_events` - سجل أحداث التقرير (Timeline)
- `report_comments` - التعليقات على التقارير
- `report_attachments` - المرفقات (ملفات، لقطات شاشة)
- `report_labels` - وسوم التصنيف
- `report_label_links` - ربط الوسوم بالتقارير
- `report_duplicates` - التقارير المكررة
- `report_assignees` - المكلفون بالتقرير
- `report_severity` - مستويات الخطورة

**المكافآت والمدفوعات:**
- `bounty_policies` - سياسات المكافآت لكل برنامج
- `bounty_awards` - المكافآت الممنوحة
- `bounty_payments` - سجل المدفوعات
- `wallets` - محافظ الباحثين
- `wallet_transactions` - معاملات المحفظة
- `payout_requests` - طلبات السحب
- `payment_methods` - طرق الدفع

**التواصل والدعم:**
- `conversations` - المحادثات
- `conversation_members` - أعضاء المحادثة
- `messages` - الرسائل
- `notifications` - الإشعارات
- `notification_preferences` - تفضيلات الإشعارات
- `support_tickets` - تذاكر الدعم
- `support_messages` - رسائل الدعم

**السمعة والحوكمة:**
- `researcher_reputation` - نقاط السمعة
- `researcher_stats` - إحصائيات الباحث
- `badges` - تعريف الشارات
- `researcher_badges` - شارات الباحث المكتسبة
- `achievements` - الإنجازات
- `leaderboard_snapshots` - لقطات لوحة المتصدرين
- `hall_of_fame` - قاعة المشاهير
- `disputes` - النزاعات
- `dispute_messages` - رسائل النزاعات
- `moderation_actions` - إجراءات الإشراف
- `audit_logs` - سجلات التدقيق
- `security_events` - الأحداث الأمنية
- `api_keys` - مفاتيح API
- `platform_settings` - إعدادات المنصة

### الأمان (RLS)

جميع الجداول محمية بـ **Row Level Security** مع سياسات دقيقة:
- الباحثون: يرون تقاريرهم فقط
- الشركات: ترى تقارير برامجها فقط
- أعضاء الفريق: حسب صلاحياتهم (owner, admin, triager, viewer)
- المشرفون/المديرون: صلاحيات كاملة محددة

## 🌐 دعم اللغة والاتجاه

- **العربية (RTL)** - اللغة الأساسية
- **English (LTR)** - مدعومة بالكامل
- تبديل ديناميكي للغة والاتجاه
- خطوط عربية محسنة (Cairo)
- تنسيق تواريخ وأرقام عربي

## 🌙 الوضع الداكن/الفاتح

- دعم كامل لـ Dark/Light Mode
- متغيرات CSS للألوان
- حفظ التفضيل في localStorage
- مزامنة مع تفضيل النظام

## 📱 التصميم المتجاوب

- Mobile-first approach
- نقاط توقف: 640px, 768px, 1024px, 1280px, 1400px
- جداول قابلة للتمرير على الموبايل
- تنقل متجاوب (Sidebar → Drawer)
- نماذج محسنة للمس

## 🧪 الاختبارات

```bash
# اختبارات الوحدة والتكامل
npm run test

# اختبارات E2E مع Playwright
npm run test:e2e

# تغطية الكود
npm run test:coverage
```

### أنواع الاختبارات
- **Unit**: دوال مساعدة، Hooks، Schemas
- **Integration**: Server Actions، API Routes، Database
- **Security**: RLS Policies، Authorization، Input Validation
- **E2E**: تدفقات المستخدم الكاملة

## 📚 الوثائق

| الملف | الوصف |
|--------|---------|
| [ARCHITECTURE.md](docs/architecture.md) | معمارية النظام، أنماط التصميم |
| [DATABASE.md](docs/database.md) | مخطط قاعدة البيانات، العلاقات |
| [AUTHENTICATION.md](docs/authentication.md) | نظام المصادقة، الجلسة، MFA |
| [AUTHORIZATION.md](docs/authorization.md) | RLS، الأدوار، الصلاحيات |
| [REPORTS.md](docs/reports.md) | نظام التقارير، سير العمل |
| [PROGRAMS.md](docs/programs.md) | إدارة البرامج، الأصول، القواعد |
| [PAYMENTS.md](docs/payments.md) | المكافآت، المحافظ، السحب |
| [WALLET.md](docs/wallet.md) | نظام المحفظة المالية |
| [SECURITY.md](docs/security.md) | ممارسات الأمان، التهديدات |
| [DEPLOYMENT.md](DEPLOYMENT.md) | النشر على Vercel، الإنتاج |
| [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | إعداد Supabase خطوة بخطوة |
| [GITHUB_SETUP.md](GITHUB_SETUP.md) | إعداد GitHub، Actions، Secrets |
| [CONTRIBUTING.md](CONTRIBUTING.md) | إرشادات المساهمة |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | مدونة السلوك |
| [CHANGELOG.md](CHANGELOG.md) | سجل التغييرات |

## 🔒 الأمان

- **RLS على جميع الجداول** - لا تعتمد على حماية Frontend فقط
- **Server-side Authorization** - التحقق من الصلاحيات في Server Actions
- **Zod Validation** - التحقق من جميع المدخلات
- **Secure Cookies** - HttpOnly, SameSite, Secure
- **CSP Headers** - Content Security Policy
- **Rate Limiting** - حماية من إساءة الاستخدام
- **File Upload Validation** - أنواع، أحجام، مسح فيروسات
- **Audit Logging** - تتبع جميع الإجراءات الحساسة
- **No Secrets in Client** - Service Role Key فقط على الخادم

## 🤝 المساهمة

نرحب بمساهماتكم! يرجى قراءة:
- [CONTRIBUTING.md](CONTRIBUTING.md) - إرشادات المساهمة
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - مدونة السلوك
- [SECURITY.md](SECURITY.md) - الإبلاغ عن الثغرات الأمنية

### سير عمل المساهمة
1. Fork المستودع
2. أنشئ فرع للميزة (`git checkout -b feature/amazing-feature`)
3. اكتب الكود مع الاختبارات
4. تأكد من نجاح `npm run lint && npm run typecheck && npm run test`
5. Commit مع رسائل واضحة (`git commit -m 'feat: add amazing feature'`)
6. Push للفرع (`git push origin feature/amazing-feature`)
7. افتح Pull Request

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.

## 🙏 شكر وتقدير

- [HackerOne](https://hackerone.com) - للإلهام
- [Supabase](https://supabase.com) - للمنصة الرائعة
- [shadcn/ui](https://ui.shadcn.com) - لمكونات UI الجميلة
- [Vercel](https://vercel.com) - للاستضافة الممتازة
- مجتمع المطورين المصريين

## 📞 التواصل

- **الموقع**: [masrbounty.com](https://masrbounty.com) (قريباً)
- **البريد الإلكتروني**: security@masrbounty.com
- **GitHub Issues**: للأخطاء والميزات
- **GitHub Discussions**: للأسئلة والنقاشات

---

<div align="center">
  <p>صنع بـ ❤️ في مصر</p>
  <p>MasrBounty - منصة Bug Bounty مصرية احترافية</p>
</div>