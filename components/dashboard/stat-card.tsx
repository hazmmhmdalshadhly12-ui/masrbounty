import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  label?: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  href?: string;
  accent?: boolean;
}

function StatCard({
  title,
  label,
  value,
  description,
  icon: Icon,
  trend,
  href,
  accent = false,
  className,
  ...props
}: StatCardProps) {
  const heading = label ?? title ?? '';
  const TrendIcon = trend && trend.value >= 0 ? TrendingUp : TrendingDown;
  const body = (
    <CardContent className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{heading}</p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              accent
                ? 'bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-[26px] font-black leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
              trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {trend.value >= 0 ? '+' : ''}
            {trend.value}%
            {trend.label && <span className="font-normal text-muted-foreground">{trend.label}</span>}
          </span>
        )}
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      {href && (
        <span className="mt-2 inline-block text-xs text-muted-foreground underline-offset-4 hover:underline">
          عرض التفاصيل
        </span>
      )}
    </CardContent>
  );
  return (
    <Card className={cn('overflow-hidden transition-colors hover:border-slate-400', className)} {...props}>
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

export { StatCard };
