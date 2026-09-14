import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/utils/time';
import { isInternalLink } from '@/lib/links';

export interface NotificationRow {
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read?: boolean;
  created_at?: string | null;
}

interface NotificationItemProps {
  notification: NotificationRow;
  title?: string;
  className?: string;
}

export function NotificationItem({ notification: n, title, className }: NotificationItemProps) {
  const href = n.link && isInternalLink(n.link) ? n.link : '/dashboard/notifications';
  return (
    <Link
      href={href}
      aria-label={title ?? n.title}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent',
        n.is_read ? 'opacity-75' : 'border-slate-300 bg-card',
        className
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          n.is_read ? 'bg-muted text-muted-foreground' : 'bg-slate-900 text-amber-400'
        )}
      >
        <Bell className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block leading-snug', !n.is_read && 'font-bold')}>{n.title}</span>
        {n.body && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>}
        {n.created_at && <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>}
      </span>
      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="غير مقروء" />}
    </Link>
  );
}
