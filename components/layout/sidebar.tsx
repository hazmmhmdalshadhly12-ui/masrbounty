import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  items?: SidebarItem[];
  activeHref?: string;
}

function Sidebar({ items = [], activeHref, className, children, ...props }: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden w-64 shrink-0 flex-col gap-4 border-e border-border bg-card p-4 text-card-foreground md:flex',
        className,
      )}
      {...props}
    >
      <Link href="/" className="flex items-center gap-2 px-2 font-bold tracking-tight">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
          <ShieldCheck className="h-4 w-4" />
        </span>
        MasrBounty
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Sidebar">
        {items.map((item) => {
          const Icon = item.icon ?? LayoutDashboard;
          const isActive = activeHref === item.href;
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
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </aside>
  );
}

export { Sidebar };
export type { SidebarProps };
