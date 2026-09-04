'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { nav } from '@/config/nav';
import { Button } from '@/components/ui/button';

export function MobileMenu({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-md border"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 z-50 border-b bg-background shadow-lg">
          <nav className="container flex flex-col py-3">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm hover:bg-muted"
              >
                {n.ar}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t pt-3">
              {loggedIn ? (
                <Link href="/dashboard" onClick={() => setOpen(false)} className="flex-1">
                  <Button className="w-full bg-slate-900 text-white">
                    <LayoutDashboard className="h-4 w-4" /> لوحتي
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full">دخول</Button>
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="flex-1">
                    <Button className="w-full bg-slate-900 text-white">حساب جديد</Button>
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
