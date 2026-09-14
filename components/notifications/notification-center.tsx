'use client';

import { useEffect, useState } from 'react';
import { BellRing, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/loaders/spinner';
import { NotificationItem, type NotificationRow } from '@/components/notifications/notification-item';

interface NotificationCenterProps {
  initial?: NotificationRow[];
  title?: string;
  limit?: number;
}

export function NotificationCenter({ initial = [], title = 'الإشعارات', limit = 20 }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationRow[]>(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (initial.length > 0) return;
    let alive = true;
    fetch(`/api/notifications?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !alive) return;
        setItems(j.items ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initial.length, limit]);

  async function markAllRead() {
    setMarking(true);
    try {
      const res = await fetch('/api/notifications/read', { method: 'POST' });
      if (res.ok) setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* best effort */
    } finally {
      setMarking(false);
    }
  }

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <BellRing className="h-4 w-4 text-muted-foreground" />
          {title}
          {unread > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white" dir="ltr">
              {unread}
            </span>
          )}
        </h3>
        {unread > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead} disabled={marking}>
            <CheckCheck className="h-3.5 w-3.5" />
            تعيين الكل كمقروء
          </Button>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      ) : !items.length ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">لا إشعارات — كل جديد سيظهر هنا.</p>
      ) : (
        items.map((n) => <NotificationItem key={n.id} notification={n} />)
      )}
    </div>
  );
}
