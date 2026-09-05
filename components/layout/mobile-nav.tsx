'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { nav } from '@/config/nav';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 z-50 border-b bg-background shadow-lg">
          <nav className="container flex flex-col py-2" aria-label="التنقل الرئيسي">
            {[{ href: '/', ar: 'الرئيسية', en: 'Home' }, ...nav].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-3 text-[15px]',
                  pathname === n.href ? 'bg-accent font-bold' : 'text-muted-foreground'
                )}
              >
                {n.ar}
              </Link>
            ))}
            <div className="flex gap-2 border-t py-3">
              <Link href="/login" onClick={() => setOpen(false)} className="flex-1 rounded-lg border px-3 py-2.5 text-center text-sm font-bold">
                تسجيل الدخول
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-bold text-white dark:bg-amber-400 dark:text-slate-950">
                إنشاء حساب
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
