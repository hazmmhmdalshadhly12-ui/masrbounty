import { cn } from '@/lib/utils';
import { Avatar } from '@/components/shared/avatar';
import { timeAgo } from '@/utils/time';

export interface MessageRow {
  id: string;
  body: string;
  sender_name?: string | null;
  is_mine?: boolean;
  created_at?: string | null;
}

interface MessageBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  message: MessageRow;
  title?: string;
}

export function MessageBox({ message, title, className, ...props }: MessageBoxProps) {
  return (
    <div
      className={cn('flex gap-2 rounded-lg border p-2.5', message.is_mine && 'bg-accent', className)}
      aria-label={title ?? 'رسالة'}
      {...props}
    >
      <Avatar name={message.sender_name ?? '?'} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
          {message.sender_name && (
            <span className="font-bold text-foreground" dir="ltr">
              @{message.sender_name}
            </span>
          )}
          {message.created_at && <span>{timeAgo(message.created_at)}</span>}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
      </div>
    </div>
  );
}
