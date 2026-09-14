import * as React from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export interface HofEntry {
  rank: number;
  username: string;
  points: number;
  avatarUrl?: string;
  title?: string;
}

interface HofCardProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: HofEntry;
  highlight?: boolean;
}

const rankStyles: Record<number, string> = {
  1: 'bg-amber-400 text-amber-950 dark:bg-amber-400 dark:text-amber-950',
  2: 'bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-100',
  3: 'bg-amber-700 text-amber-50 dark:bg-amber-800 dark:text-amber-50',
};

function HofCard({ entry, highlight = false, className, ...props }: HofCardProps) {
  const initials = entry.username.slice(0, 2).toUpperCase();
  return (
    <Card className={cn(highlight && 'border-amber-400/60 shadow-sm', className)} {...props}>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            rankStyles[entry.rank] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {entry.rank <= 3 ? <Trophy className="h-4 w-4" /> : entry.rank}
        </span>
        <Avatar className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {initials}
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{entry.username}</p>
          {entry.title && <p className="truncate text-xs text-muted-foreground">{entry.title}</p>}
        </div>
        <Badge variant={highlight ? 'default' : 'secondary'} className="tabular-nums">
          {entry.points.toLocaleString()}
        </Badge>
      </CardContent>
    </Card>
  );
}

export { HofCard };
export type { HofCardProps };
