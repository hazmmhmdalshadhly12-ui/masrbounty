'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LayoutDashboard, LogOut, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/shared/avatar';

interface UserDropdownProps {
  name: string;
  email?: string | null;
  dashboardHref?: string;
  profileHref?: string;
  settingsHref?: string;
  title?: string;
  className?: string;
}

export function UserDropdown({
  name,
  email,
  dashboardHref = '/dashboard',
  profileHref = '/profile',
  settingsHref = '/dashboard/settings',
  title,
  className,
}: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: dashboardHref, label: 'لوحتي', Icon: LayoutDashboard },
    { href: profileHref, label: 'الملف الشخصي', Icon: User },
    { href: settingsHref, label: 'الإعدادات', Icon: Settings },
  ];
  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={title ?? 'قائمة المستخدم'}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors hover:bg-accent"
      >
        <Avatar name={name} size="sm" />
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="إغلاق" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute left-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border bg-popover shadow-xl">
            <div className="border-b px-4 py-3">
              <p className="truncate text-sm font-bold">{name}</p>
              {email && (
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {email}
                </p>
              )}
            </div>
            {links.map(({ href, label, Icon }) => (
              <Link
                key={href + label}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
            <form action="/auth/signout" method="post" className="border-t">
              <button type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-accent">
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
