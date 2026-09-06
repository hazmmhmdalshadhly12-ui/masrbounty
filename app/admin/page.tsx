import Link from 'next/link';
import { LayoutDashboard, Users, Building2, AppWindow, FileText, CreditCard, Scale, ShieldCheck, ScrollText, LifeBuoy, Settings as SettingsIcon, Gavel } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';

export default async function AdminHome() {
  const supabase = await createServerClient();
  const tables = ['profiles', 'programs', 'reports', 'payout_requests', 'disputes', 'support_tickets'] as const;
  const labels: Record<string, string> = {
    profiles: 'المستخدمون',
    programs: 'البرامج',
    reports: 'التقارير',
    payout_requests: 'طلبات السحب',
    disputes: 'النزاعات',
    support_tickets: 'تذاكر الدعم',
  };
  const counts = await Promise.all(tables.map(async (t) => ({ t, n: (await supabase.from(t).select('id', { count: 'exact', head: true })).count ?? 0 })));
  const links = [
    { href: '/admin/users', label: 'المستخدمون', Icon: Users },
    { href: '/admin/companies', label: 'الشركات', Icon: Building2 },
    { href: '/admin/programs', label: 'البرامج', Icon: AppWindow },
    { href: '/admin/reports', label: 'التقارير', Icon: FileText },
    { href: '/admin/payments', label: 'المدفوعات', Icon: CreditCard },
    { href: '/admin/disputes', label: 'النزاعات', Icon: Scale },
    { href: '/admin/verification', label: 'التحقق', Icon: ShieldCheck },
    { href: '/admin/moderation', label: 'الإشراف', Icon: Gavel },
    { href: '/admin/audit-logs', label: 'التدقيق', Icon: ScrollText },
    { href: '/admin/support', label: 'الدعم', Icon: LifeBuoy },
    { href: '/admin/settings', label: 'الإعدادات', Icon: SettingsIcon },
  ];
  return (
    <div className="py-2">
      <PageHeader icon={LayoutDashboard} title="لوحة الإدارة" desc="نظرة شاملة على المنصة — الإحصائيات والأقسام" />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {counts.map((c) => (
          <StatCard key={c.t} label={labels[c.t]} value={c.n} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-slate-400 hover:bg-accent">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="text-sm font-bold">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
