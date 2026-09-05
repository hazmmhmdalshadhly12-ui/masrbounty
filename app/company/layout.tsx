import { requireSession } from '@/lib/auth/guard';
import { DashboardShell } from '@/components/layout/dashboard-shell';

const links = [
  { href: '/company', label: 'نظرة عامة', icon: 'dashboard' },
  { href: '/company/programs', label: 'البرامج', icon: 'programs' },
  { href: '/company/reports', label: 'التقارير', icon: 'reports' },
  { href: '/company/researchers', label: 'الباحثون', icon: 'team' },
  { href: '/company/team', label: 'الفريق', icon: 'team' },
  { href: '/company/messages', label: 'الرسائل', icon: 'messages' },
  { href: '/company/analytics', label: 'التحليلات', icon: 'analytics' },
  { href: '/company/payments', label: 'المدفوعات', icon: 'payments' },
  { href: '/company/settings', label: 'الإعدادات', icon: 'settings' },
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  await requireSession({ next: '/company' });
  return (
    <DashboardShell title="لوحة الشركة" links={links}>
      {children}
    </DashboardShell>
  );
}
