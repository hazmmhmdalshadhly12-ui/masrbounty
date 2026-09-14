import { Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/shared/avatar';

export interface LeaderboardRow {
  researcher_id: string;
  display_name: string;
  score: number;
  total_earned?: number;
  accepted_reports?: number;
}

interface BoardProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: LeaderboardRow[];
  metric?: 'reputation' | 'earnings' | 'accepted';
  title?: string;
}

export function Board({ rows = [], metric = 'reputation', title, className, ...props }: BoardProps) {
  const value = (r: LeaderboardRow) =>
    metric === 'earnings'
      ? `${Number(r.total_earned ?? 0).toLocaleString()} EGP`
      : metric === 'accepted'
        ? `${r.accepted_reports ?? 0} تقرير`
        : `${r.score} نقطة`;
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {title && <h3 className="mb-1 text-sm font-bold text-muted-foreground">{title}</h3>}
      {!rows.length ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">لا باحثين بعد.</p>
      ) : (
        rows.map((r, i) => (
          <Card key={r.researcher_id} className={i < 3 ? 'border-amber-400/60 bg-amber-50 dark:bg-amber-950/20' : ''}>
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a1628] font-black text-amber-400">
                {i < 3 ? <Medal className="h-5 w-5" /> : i + 1}
              </span>
              <Avatar name={r.display_name} />
              <span className="flex-1 truncate font-bold">{r.display_name}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground" dir="ltr">
                {value(r)}
              </span>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export const LeaderboardBoard = Board;
