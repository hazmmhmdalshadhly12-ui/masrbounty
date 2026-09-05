import { DashboardShell } from '@/components/layout/dashboard-shell';

const links = [
  { href: '/dashboard', label: 'نظرة عامة', icon: 'dashboard' },
  { href: '/dashboard/reports', label: 'تقاريري', icon: 'reports' },
  { href: '/dashboard/reports/new', label: 'تقرير جديد', icon: 'new' },
  { href: '/dashboard/programs', label: 'برامجي المحفوظة', icon: 'saved' },
  { href: '/dashboard/wallet', label: 'المحفظة', icon: 'wallet' },
  { href: '/dashboard/payments', label: 'المدفوعات', icon: 'payments' },
  { href: '/dashboard/badges', label: 'الشارات', icon: 'badges' },
  { href: '/dashboard/verification', label: 'التحقق', icon: 'verification' },
  { href: '/dashboard/messages', label: 'الرسائل', icon: 'messages' },
  { href: '/dashboard/notifications', label: 'الإشعارات', icon: 'notifications' },
  { href: '/dashboard/settings', label: 'الإعدادات', icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="لوحة الباحث" links={links}>
      {children}
    </DashboardShell>
  );
}
