'use client';

import type { Notification } from './types';

export function NotificationsView({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">All caught up</p>
        <p className="text-sm text-muted-foreground">No notifications.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {notifications.map((n) => (
        <li key={n.id} className={`p-3 text-sm ${n.is_read ? 'opacity-60' : ''}`}>
          <p className="font-medium">{n.title}</p>
          {n.body && <p className="text-muted-foreground">{n.body}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {n.type} · {new Date(n.created_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{count}</span>;
}
