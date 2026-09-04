import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminHome() {
  const supabase = createServerClient();
  const tables = ['profiles', 'programs', 'reports', 'payout_requests', 'disputes', 'support_tickets'] as const;
  const counts = await Promise.all(tables.map(async (t) => ({ t, n: (await supabase.from(t).select('id', { count: 'exact', head: true })).count ?? 0 })));
  const links = [
    { href: '/admin/users', label: 'Users' }, { href: '/admin/companies', label: 'Companies' },
    { href: '/admin/programs', label: 'Programs' }, { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/payments', label: 'Payments' }, { href: '/admin/disputes', label: 'Disputes' },
    { href: '/admin/moderation', label: 'Moderation' }, { href: '/admin/audit-logs', label: 'Audit logs' },
    { href: '/admin/support', label: 'Support' }, { href: '/admin/settings', label: 'Settings' },
  ];
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">لوحة الإدارة</h1>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {counts.map((c) => <Card key={c.t}><CardHeader><CardTitle className="text-sm">{c.t}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{c.n}</CardContent></Card>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {links.map((l) => <Link key={l.href} href={l.href} className="border rounded-md p-4 hover:bg-accent">{l.label}</Link>)}
      </div>
    </main>
  );
}
