import Link from 'next/link';
import { Building2, AppWindow } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusPill } from '@/components/shared/status-pill';

export const dynamic = 'force-dynamic';

type CompanyRow = { id: string; name: string; slug: string };

export default async function CompanyPrograms() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-6 text-sm">سجّل الدخول أولًا.</div>;

  // Resolve companies the user owns or is a member of — never list other companies' programs.
  const [{ data: memberships }, { data: owned }] = await Promise.all([
    supabase.from('company_members').select('company_id,company_profiles(id,name,slug)').eq('user_id', user.user.id),
    supabase.from('company_profiles').select('id,name,slug').eq('owner_id', user.user.id),
  ]);

  if (!memberships?.length && !owned?.length) {
    return (
      <div className="py-2">
        <PageHeader icon={Building2} title="برامج الشركة" desc="أنشئ ملف شركتك أولًا لبدء إنشاء البرامج" />
        <EmptyState
          title="لا توجد شركة بعد"
          hint="أنشئ ملف الشركة من إعدادات الشركة، أو اطلب من المالك دعوتك للفريق."
          action={<Link href="/company/settings" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900">إعدادات الشركة</Link>}
        />
      </div>
    );
  }

  const memberCompanies = ((memberships ?? []) as unknown as { company_profiles: CompanyRow | null }[])
    .map((m) => m.company_profiles)
    .filter((v): v is CompanyRow => Boolean(v));
  const companies: CompanyRow[] = [...((owned ?? []) as CompanyRow[]), ...memberCompanies];
  const uniqCompanies = [...new Map(companies.map((c) => [c.id, c] as const)).values()];
  const companyNames = new Map(uniqCompanies.map((c) => [c.id, c.name] as const));
  const companyIds = uniqCompanies.map((c) => c.id);

  const { data: programs } = await supabase
    .from('programs')
    .select('id,name,slug,status,visibility,company_id')
    .in('company_id', companyIds.length ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="py-2">
      <PageHeader
        icon={AppWindow}
        title="برامج الشركة"
        desc="إدارة برامج مكافآت الثغرات الخاصة بمؤسستك"
        action={<Button asChild><Link href="/company/programs/new">إنشاء برنامج</Link></Button>}
      />
      {!programs?.length ? (
        <EmptyState
          title="لا توجد برامج بعد"
          hint="أنشئ أول برنامج مكافآت لمؤسستك لبدء استقبال تقارير الباحثين."
          action={<Button asChild><Link href="/company/programs/new">إنشاء برنامج</Link></Button>}
        />
      ) : (
        programs.map((p) => (
          <Card key={p.id} className="mb-2 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Link href={`/company/programs/${p.id}`} className="hover:underline">{p.name}</Link>
                <StatusPill value={p.status} />
                <Badge variant="secondary">{p.visibility === 'public' ? 'عام' : 'خاص'}</Badge>
                <span className="text-xs font-normal text-muted-foreground">{companyNames.get(p.company_id) ?? ''}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/company/programs/${p.id}`} className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400">إدارة البرنامج ←</Link>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
