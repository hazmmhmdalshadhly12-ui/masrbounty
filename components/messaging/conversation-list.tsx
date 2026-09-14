import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConversationRow {
  id: string;
  subject?: string | null;
  last_message?: string | null;
  updated_at?: string | null;
}

interface ConversationListProps extends React.HTMLAttributes<HTMLDivElement> {
  conversations?: ConversationRow[];
  activeId?: string | null;
  baseHref?: string;
  title?: string;
}

export function ConversationList({
  conversations = [],
  activeId,
  baseHref = '?c=',
  title = 'المحادثات',
  className,
  ...props
}: ConversationListProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {title && <h3 className="px-1 text-sm font-bold text-muted-foreground">{title}</h3>}
      {!conversations.length ? (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">لا توجد محادثات — ابدأ واحدة من صفحة التقرير.</p>
      ) : (
        conversations.map((c) => {
          const active = c.id === activeId;
          return (
            <Link
              key={c.id}
              href={`${baseHref}${c.id}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex items-start gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-accent',
                active && 'border-slate-400 bg-accent'
              )}
            >
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate font-bold">{c.subject || `محادثة ${c.id.slice(0, 8)}`}</span>
                {c.last_message && <span className="block truncate text-xs text-muted-foreground">{c.last_message}</span>}
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
}
