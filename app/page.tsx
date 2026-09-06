import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, FileSearch, Wallet, Trophy, Building2, Lock, ArrowLeft } from 'lucide-react';
import { HeroVisual } from '@/components/home/hero-visual';
import { HeroStats } from '@/components/home/hero-stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  ['01', 'اختر البرنامج', 'راجع النطاق والقواعد ونطاقات المكافآت قبل أن تبدأ'],
  ['02', 'وثّق الثغرة', 'أرسل تقريرًا منهجيًا: الأثر، خطوات الاستنساخ، والمقترح العلاجي'],
  ['03', 'استلم مكافأتك', 'عند القبول تُقيّد المكافأة في محفظتك وتطلب سحبها متى شئت'],
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
    const [p, r, u] = await Promise.all([
      supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
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
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden border-b bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'linear-gradient(to left, rgb(148 163 184 / 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.25) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="container relative grid items-center gap-12 py-20 md:py-28 lg:grid-cols-2">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-sm font-medium text-amber-400">
              <span className="inline-block h-px w-10 bg-amber-400" />
              منصة مصرية لبرامج مكافآت الثغرات
            </p>
            <h1 className="mt-5 text-4xl font-black leading-[1.3] tracking-tight md:text-5xl">
              اكتشف الثغرات. احم الشركات.
              <br />
              <span className="text-slate-400">اكسب المكافآت.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              اختبارات أمنية مصرح بها فقط — تقارير منهجية، تقييم شفاف، ومستحقات تصل لأصحابها.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/programs">
                <Button size="lg" className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">
                  استكشف البرامج
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-white/10 hover:text-white">
                  ابدأ كباحث أمني <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-6">
              <Link href="/register" className="text-sm text-slate-300 underline underline-offset-4 hover:text-white">
                شركتك تحتاج حماية؟ أطلق برنامج Bug Bounty
              </Link>
            </div>
            <HeroStats stats={[[String(programs), 'برنامجًا نشطًا'], [String(reports), 'تقريرًا مُقدّمًا'], [String(researchers), 'باحثًا مسجلًا']]} />
          </div>
          <div className="hidden lg:block">
            <HeroVisual programs={programs} reports={reports} researchers={researchers} />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container py-16 md:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-amber-600">المنصة</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">بنية متكاملة لدورة البلاغ</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">من الاكتشاف حتى صرف المستحقات — كل مرحلة موثقة وقابلة للتتبع.</p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-6">
              <f.icon className="h-5 w-5 text-amber-600" strokeWidth={2} />
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STEPS */}
      <section className="border-y bg-muted/40">
        <div className="container py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-amber-600">آلية العمل</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">ثلاث خطوات للبدء</h2>
          </div>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map(([n, title, desc]) => (
              <li key={n} className="border-t-2 border-slate-900 pt-5 dark:border-slate-100">
                <p className="text-sm font-black tabular-nums text-muted-foreground">{n}</p>
                <h3 className="mt-2 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* COMPANY CTA */}
      <section className="container py-16 md:py-20">
        <div className="grid items-center gap-8 rounded-xl border bg-slate-950 p-8 text-white md:grid-cols-[1fr_auto] md:p-12">
          <div>
            <p className="text-sm font-bold text-amber-400">للشركات</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">حوّل مجتمع الباحثين إلى خط دفاعك الأول</h2>
            <p className="mt-3 max-w-xl leading-relaxed text-slate-300">
              أنشئ برنامجك الخاص، حدد النطاق والقواعد، واستقبل تقارير موثقة من باحثين مؤهلين.
            </p>
          </div>
          <Link href="/register" className="shrink-0">
            <Button size="lg" className="bg-white font-bold text-slate-950 hover:bg-slate-200">
              سجّل شركتك
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
