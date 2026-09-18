'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, AppWindow, FileText, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'الرئيسية', Icon: Home },
  { href: '/programs', label: 'البرامج', Icon: AppWindow },
  { href: '/dashboard/reports/new', label: 'بلّغ', Icon: FileText },
  { href: '/dashboard/notifications', label: 'التنبيهات', Icon: Bell },
  { href: '/dashboard', label: 'حسابي', Icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={cn(
                'flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                active ? 'font-bold text-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
