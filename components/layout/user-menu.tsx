'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/features/auth/services';
import { Avatar } from '@/components/shared/avatar';

export function UserMenu({ username, email }: { username: string; email?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="قائمة المستخدم"
        aria-expanded={open}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar name={username || email || '?'} size="sm" className="h-9 w-9" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border bg-popover shadow-xl">
            <div className="border-b px-4 py-3">
              <p className="truncate text-sm font-bold" dir="ltr">@{username}</p>
              {email && <p className="truncate text-xs text-muted-foreground" dir="ltr">{email}</p>}
            </div>
            {[
              ['لوحتي', '/dashboard'],
              ['ملفي', '/profile'],
              ['التقارير', '/dashboard/reports'],
              ['المحفظة', '/dashboard/wallet'],
              ['الإعدادات', '/dashboard/settings'],
            ].map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-accent">
                {label}
              </Link>
            ))}
            <form action={logoutAction} className="border-t">
              <button type="submit" className="block w-full px-4 py-2.5 text-right text-sm text-red-600 hover:bg-accent">
                تسجيل الخروج
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
