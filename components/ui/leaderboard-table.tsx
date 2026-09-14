import * as React from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  avatarUrl?: string;
  reportsCount?: number;
}

interface LeaderboardTableProps extends React.HTMLAttributes<HTMLDivElement> {
  entries: LeaderboardEntry[];
  emptyMessage?: string;
}

function LeaderboardTable({ entries, emptyMessage = 'No entries yet.', className, ...props }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return <p className={cn('py-8 text-center text-sm text-muted-foreground', className)}>{emptyMessage}</p>;
  }
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-card-foreground', className)} {...props}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Researcher</th>
              <th className="px-4 py-3 font-medium">Reports</th>
              <th className="px-4 py-3 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.username} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                    {entry.rank <= 3 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                    {entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <Avatar className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {entry.username.slice(0, 2).toUpperCase()}
                    </Avatar>
                    <span className="font-medium">{entry.username}</span>
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {entry.reportsCount ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Badge variant="secondary" className="tabular-nums">
                    {entry.points.toLocaleString()}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { LeaderboardTable };
export type { LeaderboardTableProps };
