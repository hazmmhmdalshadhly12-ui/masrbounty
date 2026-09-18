'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { nav } from '@/config/nav';
import { cn } from '@/lib/utils';

export function MobileNav({ authed = false }: { authed?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>
      {open && (
        <div id="mobile-nav-panel" className="absolute inset-x-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b bg-background shadow-lg">
          <nav className="container flex flex-col py-2" aria-label="التنقل الرئيسي">
            {[{ href: '/', ar: 'الرئيسية', en: 'Home' }, ...nav].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === n.href ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  pathname === n.href ? 'bg-accent font-bold' : 'text-muted-foreground'
                )}
              >
                {n.ar}
              </Link>
            ))}
            <div className="flex gap-2 border-t py-3">
              {authed ? (
                <>
                  <Link href="/dashboard" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    لوحتي
                  </Link>
                  <Link href="/profile" onClick={() => setOpen(false)} className="flex-1 rounded-lg border px-3 py-2.5 text-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    ملفي
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="flex-1 rounded-lg border px-3 py-2.5 text-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    تسجيل الدخول
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    إنشاء حساب
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
