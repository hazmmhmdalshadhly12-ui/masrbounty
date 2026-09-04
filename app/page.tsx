import Link from 'next/link';
import { ShieldCheck, Bug, Trophy, Wallet, Building2, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createServerClient } from '@/lib/supabase/server';

const features = [
  { icon: Bug, title: 'تقارير احترافية', desc: 'بلّغ عن الثغرات بتقارير مرقّمة MB-000001 وتتبع حالتها لحظة بلحظة' },
  { icon: Wallet, title: 'مكافآت حقيقية', desc: 'محفظة بأرصدة ومعاملات وطلبات سحب بمراجعة إدارية' },
  { icon: Trophy, title: 'سمعة وشارات', desc: 'نقاط سمعة ولوحة متصدّرين وقاعة مشاهير وشارات إنجاز' },
  { icon: Building2, title: 'برامج شركات', desc: 'برامج عامة وخاصة بنطاق واضح وقواعد ونطاقات مكافآت' },
  { icon: ShieldCheck, title: 'حماية كاملة', desc: 'صلاحيات على مستوى قاعدة البيانات وتدقيق لكل إجراء حساس' },
  { icon: Lock, title: 'خصوصية', desc: 'مرفقات التقارير خاصة — لا يراها إلا أطراف التقرير' },
];

const steps = [
  ['1', 'اختر برنامجًا', 'تصفح البرامج النشطة واقرأ النطاق والقواعد جيدًا'],
  ['2', 'اكتشف وبلّغ', 'ابحث داخل النطاق المصرح فقط وأرسل تقريرًا مفصلًا'],
  ['3', 'اكسب المكافأة', 'بعد القبول تُضاف المكافأة لمحفظتك وتسحبها متى شئت'],
];

export default async function Home() {
  const supabase = createServerClient();
  const [{ count: programs }, { count: reports }, { count: researchers }] = await Promise.all([
    supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).neq('status', 'draft'),
    supabase.from('researcher_profiles').select('id', { count: 'exact', head: true }),
  ]);

  const stats = [
    [String(programs ?? 0), 'برنامج نشط'],
    [String(reports ?? 0), 'تقرير مُرسل'],
    [String(researchers ?? 0), 'باحث مسجّل'],
  ];

  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0a1628] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.15),transparent_60%)]" />
        <div className="container relative py-20 text-center md:py-28">
          <span className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1 text-sm text-amber-300">
            🇪🇬 أول منصة Bug Bounty مصرية
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black leading-tight md:text-6xl">
            اكتشف الثغرات.
            <br />
            <span className="text-amber-400">اكسب المكافآت.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            MasrBounty تربط نخبة الباحثين الأمنيين بالشركات المصرية عبر برامج اختبار مصرح بها — تقارير احترافية، مكافآت عادلة، وسمعة تستحقها.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg" className="bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
                ابدأ كباحث <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/programs">
              <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-white/10">
                تصفح البرامج
              </Button>
            </Link>
          </div>
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4">
            {stats.map(([n, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-black text-amber-400 md:text-3xl">{n}</p>
                <p className="mt-1 text-xs text-slate-300 md:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container py-16">
        <h2 className="text-center text-2xl font-black md:text-3xl">لماذا MasrBounty؟</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">كل ما تحتاجه دورة البلاغ الكاملة — من الاكتشاف حتى السحب</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-400/15 text-amber-600">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* STEPS */}
      <section className="border-y bg-muted/50">
        <div className="container py-16">
          <h2 className="text-center text-2xl font-black md:text-3xl">كيف تبدأ في 3 خطوات؟</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(([n, title, desc]) => (
              <Card key={n}>
                <CardContent className="p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a1628] text-xl font-black text-amber-400">{n}</span>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 text-center">
        <div className="rounded-2xl bg-[#0a1628] px-6 py-12 text-white">
          <h2 className="text-2xl font-black md:text-3xl">عندك شركة؟ أمّنها قبل ما المخترقين يسبقوك</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">انشر برنامج Bug Bounty واستقبل تقارير من باحثين موثّقين — بأسعار تناسب السوق المصري</p>
          <Link href="/register" className="mt-6 inline-block">
            <Button size="lg" className="bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
              سجّل شركتك مجانًا
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
