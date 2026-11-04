import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, FileSearch, Wallet, Trophy, Building2, Lock, ArrowLeft, CheckCircle2, Crosshair, FileCheck2, Banknote } from 'lucide-react';
import { HeroVisual } from '@/components/home/hero-visual';
import { HeroStats } from '@/components/home/hero-stats';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';

const features = [
  { icon: FileSearch, title: 'إدارة التقارير', desc: 'دورة بلاغ كاملة: مسودة، تقديم، فرز، تقييم، قبول وحل — بأرقام تتبع فريدة' },
  { icon: Wallet, title: 'المكافآت والمدفوعات', desc: 'اعتماد المكافآت من الشركة، ومحفظة بشفافية كاملة وطلبات سحب بمراجعة' },
  { icon: Trophy, title: 'السمعة والتميز', desc: 'نقاط سمعة مبنية على نتائج حقيقية، ولوحة متصدرين وقاعة مشاهير' },
  { icon: Building2, title: 'برامج مرنة', desc: 'برامج عامة وخاصة، نطاق دقيق، قواعد واضحة، وسياسات مكافآت حسب الخطورة' },
  { icon: Lock, title: 'سرية وخصوصية', desc: 'مرفقات التقارير خاصة، وصلاحيات الوصول مضمونة على مستوى قاعدة البيانات' },
  { icon: ShieldCheck, title: 'حوكمة وعدالة', desc: 'نظام نزاعات بمراجعة محايدة، وسجل تدقيق لكل إجراء حساس' },
];

const steps = [
  { n: '01', icon: Crosshair, title: 'اختر البرنامج', desc: 'راجع النطاق والقواعد ونطاقات المكافآت قبل أن تبدأ' },
  { n: '02', icon: FileCheck2, title: 'وثّق الثغرة', desc: 'أرسل تقريرًا منهجيًا: الأثر، خطوات الاستنساخ، والمقترح العلاجي' },
  { n: '03', icon: Banknote, title: 'استلم مكافأتك', desc: 'عند القبول تُقيّد المكافأة في محفظتك وتطلب سحبها متى شئت' },
];

const severities = [
  { label: 'حرجة', cvss: '9.0–10', dot: 'bg-red-600', desc: 'سيطرة كاملة أو تسريب بيانات واسع — أعلى شريحة مكافآت' },
  { label: 'عالية', cvss: '7.0–8.9', dot: 'bg-orange-500', desc: 'وصول غير مصرح لبيانات حساسة أو تجاوز صلاحيات' },
  { label: 'متوسطة', cvss: '4.0–6.9', dot: 'bg-amber-400', desc: 'أثر محدود يتطلب شروطًا أو تفاعلًا من المستخدم' },
  { label: 'منخفضة', cvss: '0.1–3.9', dot: 'bg-sky-500', desc: 'مشكلات ضعيفة الأثر أو إعدادات تحتاج تحسينًا' },
];

const researcherPerks = [
  'برامج من شركات مصرية بنطاق وقواعد واضحة',
  'مكافآت تُقيّد في محفظتك وسحب بمراجعة شفافة',
  'سمعة مهنية ولوحة متصدرين مبنية على نتائج حقيقية',
];

const companyPerks = [
  'برامج عامة أو خاصة مع تحقق من ملكية الدومين',
  'صندوق فرز بمهل SLA وتقييم خطورة موحّد',
  'سجل تدقيق كامل وتحكم دقيق في صلاحيات الفريق',
];

export default async function Home() {
  // Logged-in users skip marketing and land on their own workspace
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
      const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
      if (mine.has('admin') || mine.has('moderator')) redirect('/admin');
      // Company role alone lands on company onboarding even before rows exist
      if (mine.has('company')) redirect('/company');
      const { data: owned } = await supabase.from('company_profiles').select('id').eq('owner_id', data.user.id).limit(1);
      const { data: member } = await supabase.from('company_members').select('id').eq('user_id', data.user.id).limit(1);
      if ((owned ?? []).length || (member ?? []).length) redirect('/company');
      redirect('/dashboard');
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e;
    /* fall through to marketing */
  }
  let programs = 0;
  let reports = 0;
  let researchers = 0;
  try {
    const supabase = await createServerClient();
    // Homepage stats — must count ONLY public+active (anon-visible). RLS can_view_program enforces same, but explicit filters guarantee it.
    const [p, r, u] = await Promise.all([
      supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('visibility', 'public'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).neq('status', 'draft'),
      supabase.from('researcher_profiles').select('id', { count: 'exact', head: true }),
    ]);
    programs = p.count ?? 0;
    reports = r.count ?? 0;
    researchers = u.count ?? 0;
  } catch {
    /* render with zeros when DB is unreachable */
  }

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-navy-800/60 bg-navy text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-ink" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 start-[-10rem] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px hairline-x" />
        <div className="container relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:py-28 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3.5 py-1.5 text-xs font-bold tracking-wide text-amber-300">
              <span aria-hidden="true" className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              منصة مصرية لبرامج مكافآت الثغرات
            </p>
            <h1 className="mt-6 text-4xl font-black leading-[1.3] tracking-tight md:text-5xl">
              اكتشف الثغرات. احمِ الشركات.
              <br />
              <span className="text-gradient-gold">اكسب المكافآت.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-100/90">
              اختبارات أمنية مصرح بها فقط — تقارير منهجية، تقييم شفاف، ومستحقات تصل لأصحابها.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-black shadow-gold hover:shadow-lift">
                <Link href="/programs">استكشف البرامج</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 font-bold text-white hover:border-amber-400/50 hover:bg-white/10 hover:text-amber-200"
              >
                <Link href="/register">
                  ابدأ كباحث أمني <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-navy-100/70">
              شركتك تحتاج حماية؟{' '}
              <Link href="/register" className="font-bold text-amber-300 underline decoration-amber-400/40 underline-offset-4 transition-colors hover:text-amber-200">
                أطلق برنامج Bug Bounty
              </Link>
            </p>
            <HeroStats stats={[[String(programs), 'برنامجًا نشطًا'], [String(reports), 'تقريرًا مُقدّمًا'], [String(researchers), 'باحثًا مسجلًا']]} />
          </div>
          <div className="hidden lg:block">
            <HeroVisual programs={programs} reports={reports} researchers={researchers} />
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="container mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-black tracking-wide text-amber-600 dark:text-amber-400">
            <span aria-hidden="true" className="inline-block h-0.5 w-8 rounded-full bg-amber-500" />
            المنصة
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">بنية متكاملة لدورة البلاغ</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">من الاكتشاف حتى صرف المستحقات — كل مرحلة موثقة وقابلة للتتبع.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-50 text-amber-600 transition-colors duration-200 group-hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-400 dark:group-hover:bg-amber-950/50">
                <f.icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= STEPS ================= */}
      <section className="border-y bg-muted/40 dark:border-navy-800/50 dark:bg-navy-900/20">
        <div className="container mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-black tracking-wide text-amber-600 dark:text-amber-400">
              <span aria-hidden="true" className="inline-block h-0.5 w-8 rounded-full bg-amber-500" />
              آلية العمل
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">ثلاث خطوات للبدء</h2>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="relative rounded-xl border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-amber-400 dark:bg-amber-400 dark:text-navy-900">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span aria-hidden="true" className="text-3xl font-black tabular-nums text-border dark:text-navy-700">
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= SEVERITY GUIDE ================= */}
      <section className="container mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-black tracking-wide text-amber-600 dark:text-amber-400">
              <span aria-hidden="true" className="inline-block h-0.5 w-8 rounded-full bg-amber-500" />
              تقييم عادل
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">المكافأة على قد الأثر</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              كل تقرير يُقيَّم حسب خطورته الفعلية وفق معايير CVSS، وكل برنامج يعلن نطاقات مكافآته مقدمًا — لا مفاجآت بعد التقديم.
            </p>
            <Button asChild variant="outline" className="mt-6 font-bold">
              <Link href="/disclosure">
                سياسة الإفصاح المسؤول <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="مستويات الخطورة">
            {severities.map((sv) => (
              <li key={sv.label} className="rounded-xl border bg-card p-4 shadow-card transition-shadow duration-200 hover:shadow-lift">
                <p className="flex items-center gap-2 font-bold">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${sv.dot}`} />
                  {sv.label}
                  <span className="ms-auto font-mono text-xs font-medium text-muted-foreground" dir="ltr">
                    CVSS {sv.cvss}
                  </span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{sv.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= AUDIENCES ================= */}
      <section className="container mx-auto max-w-6xl px-4 pb-16 md:pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="group flex flex-col rounded-2xl border bg-card p-8 shadow-card transition-shadow duration-200 hover:shadow-lift">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-400">
              <FileSearch className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-black tracking-tight">للباحثين الأمنيين</h2>
            <ul className="mt-4 flex-1 space-y-2.5 text-sm text-muted-foreground">
              {researcherPerks.map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full font-bold sm:w-auto sm:self-start">
              <Link href="/register">ابدأ الصيد الآن</Link>
            </Button>
          </div>
          <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-navy-700/60 bg-navy p-8 text-white shadow-lift">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-ink opacity-70" />
            <div className="relative">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-navy-900 shadow-gold">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-black tracking-tight">للشركات</h2>
              <ul className="mt-4 flex-1 space-y-2.5 text-sm text-navy-100/85">
                {companyPerks.map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6 w-full bg-white font-bold text-navy-900 shadow-none hover:bg-navy-100 sm:w-auto sm:self-start"
              >
                <Link href="/register">سجّل شركتك</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CTA BAND ================= */}
      <section className="container mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-navy-800/60 bg-navy px-6 py-12 text-center text-white shadow-lift md:px-12 md:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-ink" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 start-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">جاهز تبدأ أول عملية صيد؟</h2>
            <p className="mt-3 leading-relaxed text-navy-100/85">
              أنشئ حسابك مجانًا، اختر برنامجًا مناسبًا لمهاراتك، وابدأ باختبار مصرح به ضمن نطاق واضح.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="font-black shadow-gold hover:shadow-lift">
                <Link href="/register">أنشئ حسابك مجانًا</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 font-bold text-white hover:border-amber-400/50 hover:bg-white/10 hover:text-amber-200"
              >
                <Link href="/hall-of-fame">قاعة المشاهير</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
