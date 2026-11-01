'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { nav } from '@/config/nav';
import { cn } from '@/lib/utils';

const PRIMARY = ['/programs', '/researchers', '/companies', '/leaderboard'];
const EXTRA = [{ href: '/contact', ar: 'تواصل معنا', en: 'Contact' }];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  'relative rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** Desktop primary navigation with active state and an accessible "resources" menu. */
export function HeaderNav() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const primary = nav.filter((n) => PRIMARY.includes(n.href));
  const resources = [...nav.filter((n) => !PRIMARY.includes(n.href)), ...EXTRA];
  const resourcesActive = resources.some((r) => isActive(pathname, r.href));

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
      {primary.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              linkBase,
              active ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {n.ar}
            {active && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-amber-500" />}
          </Link>
        );
      })}
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            linkBase,
            'inline-flex items-center gap-1',
            resourcesActive || open ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          الموارد
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
        {open && (
          <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border bg-popover p-1 shadow-xl animate-zoom-in">
            {resources.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  role="menuitem"
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm transition-colors focus-visible:bg-accent focus-visible:outline-none',
                    active ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {n.ar}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
