import Link from 'next/link';
import { Building2, AppWindow, FileText, CheckCircle2 } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';

export default async function CompanyHome() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-2 text-sm">سجّل الدخول أولًا.</div>;
  const { data: memberships } = await supabase.from('company_members').select('company_id,role,company_profiles(id,name,slug)').eq('user_id', user.user.id);
  const { data: owned } = await supabase.from('company_profiles').select('id,name,slug').eq('owner_id', user.user.id);
  if (!memberships?.length && !owned?.length) {
    return (
      <div className="py-2">
        <PageHeader icon={Building2} title="لوحة الشركة" desc="أنشئ ملف شركتك لبدء استقبال التقارير" />
        <EmptyState
          title="لا توجد شركة بعد"
          hint="أنشئ ملف الشركة من الإعدادات، أو اطلب من المالك دعوتك للفريق."
          action={<Link href="/company/settings" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">إعدادات الشركة</Link>}
        />
      </div>
    );
  }
  const memberCompanies = ((memberships ?? []) as unknown as { company_profiles: { id: string; name: string; slug: string } | null }[]).map((m) => m.company_profiles).filter(Boolean) as { id: string; name: string; slug: string }[];
  const companies = [...((owned ?? []) as { id: string; name: string; slug: string }[]), ...memberCompanies];
  const { data: stats } = await supabase.from('program_stats_view').select('*').limit(20);
  const totals = ((stats ?? []) as { total_reports: number; resolved_reports: number }[]).reduce(
    (a, s) => ({ reports: a.reports + Number(s.total_reports), resolved: a.resolved + Number(s.resolved_reports) }),
    { reports: 0, resolved: 0 }
  );
  return (
    <div className="py-2">
      <PageHeader icon={Building2} title="لوحة الشركة" desc="برامجك وتقاريرك وأداء فرق الأمان" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="الشركات" value={companies.length} icon={Building2} href="/company/settings" />
        <StatCard label="البرامج" value={(stats ?? []).length} icon={AppWindow} href="/company/programs" />
        <StatCard label="التقارير" value={totals.reports} icon={FileText} href="/company/reports" />
        <StatCard label="المحلولة" value={totals.resolved} icon={CheckCircle2} href="/company/analytics" accent />
      </div>
      <h2 className="mb-3 font-bold">شركاتي</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {companies.map((c) => (
          <Card key={c.id} className="transition-colors hover:border-slate-400">
            <CardContent className="flex items-center justify-between p-4">
              <span className="font-bold">{c.name}</span>
              <Link href="/company/programs" className="text-xs underline">إدارة البرامج</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
