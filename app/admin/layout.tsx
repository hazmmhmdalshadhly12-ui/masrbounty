import { DashboardShell } from '@/components/layout/dashboard-shell';

const links = [
  { href: '/admin', label: 'نظرة عامة', icon: 'dashboard' },
  { href: '/admin/users', label: 'المستخدمون', icon: 'team' },
  { href: '/admin/companies', label: 'الشركات', icon: 'companies' },
  { href: '/admin/programs', label: 'البرامج', icon: 'programs' },
  { href: '/admin/reports', label: 'التقارير', icon: 'reports' },
  { href: '/admin/payments', label: 'المدفوعات', icon: 'payments' },
  { href: '/admin/disputes', label: 'النزاعات', icon: 'disputes' },
  { href: '/admin/moderation', label: 'الإشراف', icon: 'moderation' },
  { href: '/admin/audit-logs', label: 'التدقيق', icon: 'audit' },
  { href: '/admin/support', label: 'الدعم', icon: 'support' },
  { href: '/admin/settings', label: 'الإعدادات', icon: 'settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="لوحة الإدارة" links={links}>
      {children}
    </DashboardShell>
  );
}
