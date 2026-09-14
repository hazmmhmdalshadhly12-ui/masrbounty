import { Award, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/utils/time';

export interface BadgeData {
  code: string;
  name: string;
  description?: string | null;
  earned_at?: string | null;
  earned?: boolean;
}

interface BadgeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  badge: BadgeData;
  title?: string;
}

export function BadgeCard({ badge, title, className, ...props }: BadgeCardProps) {
  const earned = badge.earned ?? !!badge.earned_at;
  return (
    <Card className={cn('transition-shadow hover:shadow-md', !earned && 'opacity-70', className)} {...props}>
      <CardContent className="flex gap-3 p-4">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            earned ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-muted text-muted-foreground'
          )}
        >
          <Award className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-bold">
            <span className="truncate">{title ?? badge.name}</span>
            {earned && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
          </p>
          {badge.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{badge.description}</p>}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
            {badge.code}
            {badge.earned_at ? ` · ${formatDate(badge.earned_at)}` : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
