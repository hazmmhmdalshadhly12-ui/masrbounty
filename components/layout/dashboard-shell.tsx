'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  PlusCircle,
  Bookmark,
  Wallet,
  CreditCard,
  Award,
  MessagesSquare,
  Bell,
  Settings,
  AppWindow,
  Users,
  BarChart3,
  Building2,
  Scale,
  Gavel,
  ScrollText,
  LifeBuoy,
  GraduationCap,
  Sparkles,
  FileBadge,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  reports: FileText,
  new: PlusCircle,
  saved: Bookmark,
  wallet: Wallet,
  payments: CreditCard,
  badges: Award,
  messages: MessagesSquare,
  notifications: Bell,
  settings: Settings,
  programs: AppWindow,
  team: Users,
  analytics: BarChart3,
  companies: Building2,
  disputes: Scale,
  moderation: Gavel,
  audit: ScrollText,
  support: LifeBuoy,
  verification: ShieldCheck,
  learning: GraduationCap,
  academy: GraduationCap,
  ai: Sparkles,
  certificates: FileBadge,
  limits: Gauge,
};

export interface ShellLink {
  href: string;
  label: string;
  icon: string;
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/dashboard' || href === '/company' || href === '/admin') return false;
  return pathname.startsWith(href);
}

export function DashboardShell({
  title,
  links,
  children,
}: {
  title: string;
  links: ShellLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/40 dark:bg-background">
      <div className="container flex flex-col gap-6 py-6 md:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 md:w-64">
          <div className="overflow-hidden rounded-2xl bg-navy shadow-lift">
            <div className="relative p-3">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60 bg-grid-ink" />
              <p className="relative px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-amber-400">{title}</p>
              <nav className="relative flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {links.map((l) => {
                const Icon = icons[l.icon] ?? LayoutDashboard;
                const active = isActive(pathname, l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                      active
                        ? 'bg-amber-400 font-bold text-navy-900 shadow-gold'
                        : 'text-navy-100/85 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.4 : 2} />
                    {l.label}
                  </Link>
                );
              })}
              </nav>
              <div className="relative mt-3 hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 md:flex">
                <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400" />
                <p className="text-[11px] leading-relaxed text-navy-100/70">اختبار مصرح به فقط — أي نشاط خارج النطاق يعرض حسابك للإيقاف</p>
              </div>
            </div>
          </div>
        </aside>
        {/* Content */}
        <div className="min-w-0 flex-1 animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
