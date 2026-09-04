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
    <div className="bg-slate-100 min-h-[calc(100vh-4rem)] dark:bg-slate-950">
      <div className="container flex flex-col gap-6 py-6 md:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 md:w-60">
          <div className="overflow-hidden rounded-2xl bg-[#0a1628] p-3 text-slate-200 shadow-lg">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-amber-400">{title}</p>
            <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {links.map((l) => {
                const Icon = icons[l.icon] ?? LayoutDashboard;
                const active = isActive(pathname, l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors',
                      active ? 'bg-amber-400 font-bold text-[#0a1628]' : 'hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 hidden items-center gap-2 rounded-xl bg-white/5 p-3 md:flex">
              <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-[11px] leading-relaxed text-slate-400">اختبار مصرح به فقط — أي نشاط خارج النطاق يعرض حسابك للإيقاف</p>
            </div>
          </div>
        </aside>
        {/* Content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
