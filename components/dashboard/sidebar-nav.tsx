'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarNavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items?: SidebarNavItem[];
  activeHref?: string;
}

function SidebarNav({ items = [], activeHref, className, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  const active = activeHref ?? pathname;
  return (
    <nav aria-label="Dashboard" className={cn('flex flex-col gap-1', className)} {...props}>
      {items.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">No navigation items.</p>
      )}
      {items.map((item) => {
        const Icon = item.icon ?? LayoutDashboard;
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge != null && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                  isActive ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Legacy placeholder export retained so existing imports keep working. */
function Tmp() {
  return null;
}

export { SidebarNav, Tmp };
export type { SidebarNavProps };
