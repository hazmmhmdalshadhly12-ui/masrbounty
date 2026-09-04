import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function CompanyHome() {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: memberships } = await supabase.from('company_members').select('company_id,role,company_profiles(id,name,slug)').eq('user_id', user.user.id);
  const { data: owned } = await supabase.from('company_profiles').select('id,name,slug').eq('owner_id', user.user.id);
  if (!memberships?.length && !owned?.length) {
    return (
      <main className="container py-12">
        <h1 className="text-2xl font-bold">No company yet</h1>
        <p className="text-muted-foreground mt-2">Create one from settings or ask an owner to invite you.</p>
        <Link href="/company/settings" className="underline">Company settings</Link>
      </main>
    );
  }
  const memberCompanies = ((memberships ?? []) as unknown as { company_profiles: { id: string; name: string; slug: string } | null }[]).map((m) => m.company_profiles).filter(Boolean) as { id: string; name: string; slug: string }[];
  const companies = [...((owned ?? []) as { id: string; name: string; slug: string }[]), ...memberCompanies];
  const { data: stats } = await supabase.from('program_stats_view').select('*').limit(20);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">لوحة الشركة</h1>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {companies.map((c) => <Card key={c.id}><CardHeader><CardTitle>{c.name}</CardTitle></CardHeader><CardContent><Link href="/company/programs" className="underline text-sm">Manage programs</Link></CardContent></Card>)}
      </div>
      <h2 className="font-semibold mb-3">Program stats</h2>
      {!stats?.length ? <p className="text-muted-foreground text-sm">No programs.</p> : stats.map((s: { program_id: string; name: string; total_reports: number; resolved_reports: number }) => <p key={s.program_id} className="text-sm border-b py-2">{s.name}: {s.total_reports} reports, {s.resolved_reports} resolved</p>)}
    </main>
  );
}
