'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

interface Item {
  id: string;
  title: string;
  link: string | null;
  is_read: boolean;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/notifications?limit=5')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !alive) return;
        setUnread(j.unread ?? 0);
        setItems(j.items ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="الإشعارات"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-popover shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-sm font-bold">الإشعارات</p>
              <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
                عرض الكل
              </Link>
            </div>
            {!items.length ? (
              <p className="p-4 text-sm text-muted-foreground">لا إشعارات جديدة.</p>
            ) : (
              items.map((n) => (
                <Link key={n.id} href={n.link ?? '/dashboard/notifications'} onClick={() => setOpen(false)} className="block border-b px-4 py-2.5 text-sm last:border-0 hover:bg-accent">
                  <span className={n.is_read ? 'text-muted-foreground' : 'font-bold'}>{n.title}</span>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
