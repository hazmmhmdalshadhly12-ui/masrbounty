# معمارية MasrBounty

## نظرة عامة

MasrBounty مبنية على معمارية **Feature-Based** مع **Next.js 14 App Router**، مستفيدة من **Server Components** افتراضياً و **Client Components** فقط عند الحاجة. تستخدم **Supabase** كمنصة خلفية كاملة (Auth + Database + Storage + Realtime).

```
┌─────────────────────────────────────────────────────────────────┐
                        ┌──────────────┐
                        │   Client     │
                        │  (Browser)   │
                        └──────┬───────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
                        ┌──────────────┐
                        │   Vercel     │
                        │  Edge Network│
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  Next.js   │ │  Supabase  │ │  Supabase  │
       │  App Router│ │   Auth     │ │  Storage   │
       └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
             │              │              │
             ▼              ▼              ▼
       ┌─────────────────────────────────────────┐
       │           Supabase PostgreSQL           │
       │  (RLS, Functions, Triggers, Realtime)   │
       └─────────────────────────────────────────┘
```

## مبادئ التصميم

### 1. Server-First Architecture
- **Server Components** افتراضياً للأداء والأمان
- **Server Actions** للتعديلات (Mutations)
- **Client Components** فقط للتفاعلية (Forms, Charts, Real-time)

### 2. Feature-Based Organization
```
features/
├── auth/           # المصادقة والجلسات
├── programs/       # برامج Bug Bounty
├── reports/        # التقارير والثغرات
├── wallet/         # المحفظة والمدفوعات
├── messaging/      # المحادثات والرسائل
├── notifications/  # الإشعارات
├── reputation/     # السمعة والراتب
├── badges/         # الشارات والإنجازات
├── leaderboard/    # لوحة المتصدرين
├── hall-of-fame/   # قاعة المشاهير
├── search/         # البحث
├── admin/          # ميزات الإدارة
└── company/        # ميزات الشركات
```

كل ميزة تحتوي على:
- `types.ts` - أنواع TypeScript
- `schemas.ts` - Zod Schemas للتحقق
- `services.ts` - منطق الخادم (Server Actions)
- `hooks/` - Custom Hooks للعميل
- `components/` - مكونات UI خاصة بالميزة

### 3. Type Safety End-to-End
- **Database Types** مولدة من Supabase (`types/supabase.ts`)
- **Zod Schemas** للتحقق من المدخلات
- **TypeScript Strict Mode** مفعل
- **No `any`** إلا في حالات نادرة وموثقة

### 4. Security by Design
- **RLS على مستوى قاعدة البيانات** - خط الدفاع الأول
- **Server-side Authorization** - خط الدفاع الثاني
- **Zod Validation** - خط الدفاع الثالث
- **Audit Logging** - للتدقيق والمراقبة

## طبقة قاعدة البيانات (Database Layer)

### Supabase PostgreSQL
- **50+ جداول** مع علاقات واضحة
- **Enums** للقيم الثابتة (Status, Severity, Roles)
- **Indexes** محسنة للاستعلامات الشائعة
- **Foreign Keys** مع `ON DELETE` مناسب
- **Check Constraints** لسلامة البيانات

### Row Level Security (RLS)
```sql
-- مثال: سياسة للباحثين لرؤية تقاريرهم فقط
CREATE POLICY "researchers_view_own_reports" ON reports
FOR SELECT USING (
  researcher_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'researcher'
  )
);
```

### Functions & Triggers
- **Auto-numbering**: `generate_report_number()` → MB-000001
- **Audit Logging**: `log_audit_event()` trigger على الجداول الحساسة
- **Derived Updates**: تحديث `researcher_stats` عند تغيير حالة التقرير
- **Reputation Calculation**: دالة لحساب نقاط السمعة

### Realtime
- إشعارات فورية عبر Supabase Realtime
- تحديثات حالة التقرير المباشرة
- رسائل المحادثات الفورية

## طبقة التطبيق (Application Layer)

### Next.js App Router Structure
```
app/
├── (auth)/                 # Route Group للمصادقة
│   ├── login/
│   ├── register/
│   ├── forgot-password/
│   └── callback/
├── (public)/               # الصفحات العامة
│   ├── programs/
│   ├── companies/
│   ├── researchers/
│   ├── leaderboard/
│   ├── hall-of-fame/
│   ├── about/
│   ├── faq/
│   └── security/
├── (dashboard)/            # لوحة التحكم (محمية)
│   ├── layout.tsx          # Sidebar + Header
│   ├── reports/
│   ├── programs/
│   ├── wallet/
│   ├── messages/
│   ├── notifications/
│   └── settings/
├── (company)/              # شركة (محمية)
│   ├── layout.tsx
│   ├── programs/
│   ├── reports/
│   ├── team/
│   ├── analytics/
│   └── settings/
├── (admin)/                # إدارة (محمية)
│   ├── layout.tsx
│   ├── users/
│   ├── companies/
│   ├── programs/
│   ├── reports/
│   ├── payments/
│   ├── disputes/
│   ├── moderation/
│   ├── audit-logs/
│   └── settings/
├── api/                    # API Routes
│   ├── auth/
│   ├── webhooks/
│   └── upload/
└── globals.css             # CSS Variables + Tailwind
```

### Server Actions Pattern
```typescript
// features/reports/services.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { reportSchema } from '@/schemas/report'
import { logAuditEvent } from '@/services/audit'

export async function createReport(data: CreateReportInput) {
  // 1. التحقق من المدخلات
  const validated = reportSchema.parse(data)

  // 2. إنشاء عميل Supabase مع Service Role
  const supabase = createServerClient()

  // 3. التحقق من الصلاحيات (Server-side)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, researcher_profile_id')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (profile?.role !== 'researcher') {
    throw new Error('Unauthorized: Only researchers can create reports')
  }

  // 4. تنفيذ العملية
  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      ...validated,
      researcher_id: profile.researcher_profile_id,
      status: 'draft',
      report_number: await generateReportNumber(supabase),
    })
    .select()
    .single()

  if (error) throw error

  // 5. تدقيق
  await logAuditEvent('report.created', report.id, { program_id: validated.program_id })

  // 6. إعادة التوجيه/إعادة البيانات
  revalidatePath('/dashboard/reports')
  return report
}
```

### Client Components Pattern
```typescript
// components/reports/ReportForm.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reportSchema } from '@/schemas/report'
import { createReport } from '@/features/reports/services'

export function ReportForm({ programId }: { programId: string }) {
  const form = useForm<CreateReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { program_id: programId },
  })

  const onSubmit = async (data: CreateReportInput) => {
    try {
      const report = await createReport(data)
      toast.success('تم إنشاء التقرير بنجاح')
      router.push(`/dashboard/reports/${report.id}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

## إدارة الحالة (State Management)

### Server State - TanStack Query
```typescript
// hooks/useReports.ts
export function useReports(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', filters],
    queryFn: () => fetchReports(filters),
    staleTime: 1000 * 60 * 5, // 5 دقائق
  })
}
```

### Client State - Zustand
```typescript
// lib/store/ui-store.ts
interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  locale: 'ar' | 'en'
  toggleSidebar: () => void
  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'system',
      locale: 'ar',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'masrbounty-ui' }
  )
)
```

### Form State - React Hook Form
```typescript
const form = useForm<ReportInput>({
  resolver: zodResolver(reportSchema),
  mode: 'onBlur',
})
```

## نظام الترجمة (i18n)

### الهيكل
```
constants/
├── translations/
│   ├── ar.json          # العربية (الأساسية)
│   └── en.json          # الإنجليزية
```

### الاستخدام
```typescript
// lib/i18n.ts
'use client'
import { useLocale } from 'next-intl'
import ar from '@/constants/translations/ar.json'
import en from '@/constants/translations/en.json'

export function useTranslation() {
  const locale = useLocale()
  const t = locale === 'ar' ? ar : en
  return { t, locale, dir: locale === 'ar' ? 'rtl' : 'ltr' }
}

// في المكون
export function ReportCard({ report }: { report: Report }) {
  const { t, dir } = useTranslation()
  return <div dir={dir}>{t.reports.title}</div>
}
```

## دعم RTL/LTR

### CSS Variables Approach
```css
/* app/globals.css */
:root {
  --direction: ltr;
}

[dir="rtl"] {
  --direction: rtl;
}

/* استخدام في Tailwind */
.rtl\:text-right { text-align: right; }
.ltr\:text-left { text-align: left; }
```

### Tailwind RTL Plugin
```typescript
// tailwind.config.ts
plugins: [
  require('tailwindcss-rtl'), // أو استخدام dir variant
]
```

## الثيم (Dark/Light Mode)

### CSS Variables
```css
/* app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 199 89% 48%;
  --primary-foreground: 210 40% 98%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 199 89% 48%;
  /* ... */
}
```

### Theme Provider
```typescript
// components/providers/ThemeProvider.tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
```

## المصادقة والتخويل (Auth & Authorization)

### تدفق المصادقة
```
1. User → /login
2. Next.js → Supabase Auth (Email/OAuth)
3. Supabase → JWT في HttpOnly Cookie
4. Middleware → يتحقق من الجلسة
5. Server Components → يحصل على User من Cookie
6. Server Actions → يتحقق من الصلاحيات
7. Database (RLS) → يفرض السياسات
```

### الأدوار (Roles)
| الدور | الوصف | الصلاحيات الرئيسية |
|--------|---------|-------------------|
| `researcher` | باحث أمني | إنشاء تقارير، رؤية تقاريره، محفظة، سمعة |
| `company` | شركة (Owner) | إدارة البرامج، التقارير، الفريق، المدفوعات |
| `company_admin` | مدير فريق | صلاحيات الشركة ما عدا الفوترة |
| `company_triager` | مقيم تقارير | تriage، تعيين، تعليق على التقارير |
| `company_viewer` | مشاهد | قراءة التقارير فقط |
| `moderator` | مشرف | نزاعات، إشراف، تقارير مشبوهة |
| `admin` | مدير منصة | كل شيء، إعدادات، تدقيق، مستخدمين |

### فحص الصلاحيات
```typescript
// lib/auth/permissions.ts
export async function checkPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const supabase = createServerClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, researcher_profile_id')
    .eq('id', userId)
    .single()

  return PERMISSIONS[profile?.role]?.includes(permission) ?? false
}
```

## نظام الملفات (Storage)

### Buckets
| Bucket | الخصوصية | الاستخدام |
|--------|----------|----------|
| `avatars` | Public | صور المستخدمين والشركات |
| `company-logos` | Public | شعارات الشركات والبرامج |
| `report-attachments` | **Private** | مرفقات التقارير (لقطات شاشة، PoC) |

### سياسات الوصول للمرفقات
```sql
-- فقط صاحب التقرير، الشركة المالكة، والمشرفون
CREATE POLICY "report_attachments_access" ON storage.objects
FOR SELECT USING (
  bucket_id = 'report-attachments' AND
  (
    -- صاحب المرفق
    owner = auth.uid() OR
    -- الشركة المالكة للبرنامج
    EXISTS (
      SELECT 1 FROM reports r
      JOIN programs p ON r.program_id = p.id
      JOIN company_members cm ON p.company_id = cm.company_id
      WHERE r.id = (storage.foldername(name))[1]::uuid
      AND cm.user_id = auth.uid()
    ) OR
    -- مشرف/مدير
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  )
);
```

## معالجة الأخطاء (Error Handling)

### أنماط الأخطاء
```typescript
// lib/errors/app-error.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
  }
}
```

### Error Boundaries
```typescript
// components/ErrorBoundary.tsx
'use client'
import { Component, ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    // إرسال لخدمة مراقبة الأخطاء (Sentry, PostHog, إلخ)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}
```

## الأداء (Performance)

### استراتيجيات التحسين
1. **Server Components** - تقليل JavaScript المرسل للعميل
2. **Streaming** - `loading.tsx` و `Suspense` للبيانات البطيئة
3. **Image Optimization** - `next/image` مع Supabase Storage
4. **Font Optimization** - `next/font` مع Cairo و Inter
5. **Code Splitting** - تلقائي مع App Router
6. **Caching** - TanStack Query + Next.js Cache
7. **Database Indexes** - على الأعمدة المفلترة/المصنفة
8. **Pagination** - Cursor-based للبيانات الكبيرة

### Monitoring
- **Vercel Analytics** - Core Web Vitals
- **PostHog** - منتج وتحليلات (اختياري)
- **Supabase Dashboard** - أداء قاعدة البيانات
- **Custom Metrics** - للأعمال (تقارير، مكافآت، مستخدمون)

## النشر (Deployment)

### Vercel (الموصى به)
```yaml
# .github/workflows/deploy.yml
- Deploy to Vercel Preview على كل PR
- Deploy to Production على الدمج لـ main
- Environment Variables من Vercel Dashboard
```

### متغيرات البيئة للإنتاج
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # فقط في Vercel Secrets!
NEXT_PUBLIC_APP_URL=https://masrbounty.com
```

### Health Checks
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkStorage(),
    checkAuth(),
  ])

  const healthy = checks.every(c => c.status === 'fulfilled')
  return Response.json({ healthy, checks }, { status: healthy ? 200 : 503 })
}
```

## التوسع المستقبلي (Future Extensibility)

### Microservices Ready
- Server Actions يمكن استخراجها كـ Edge Functions
- Database Functions قابلة للاستدعاء مباشرة
- Event-driven عبر Database Triggers → Webhooks

### Multi-tenancy
- `company_id` على جميع الجداول ذات الصلة
- RLS Policies تدعم الفصل التام
- إعدادات لكل شركة في `platform_settings`

### Internationalization
- هيكل الترجمة يدعم لغات إضافية
- RTL/LTR جاهز لللغات الأخرى
- تنسيق تواريخ/أرقام/عملات محلي

---

*آخر تحديث: 2024-01-15 | الإصدار: 1.0*