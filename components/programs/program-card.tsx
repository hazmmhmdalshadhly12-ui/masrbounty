import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2, ShieldCheck, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ProgramCardData {
  id: string;
  name: string;
  company?: string;
  status?: string;
  minBounty?: number;
  maxBounty?: number;
  href?: string;
  verified?: boolean;
  severities?: string[];
  tech?: string[];
}

interface ProgramCardProps extends React.HTMLAttributes<HTMLDivElement> {
  program: ProgramCardData;
  title?: string;
}

const severityChip: Record<string, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  high: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  informational: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function ProgramCard({ program, title, className, ...props }: ProgramCardProps) {
  const heading = title ?? program.name;
  const href = program.href ?? `/programs/${program.id}`;
  const hasBounty = program.minBounty != null || program.maxBounty != null;
  return (
    <Card
      className={cn(
        'group overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-200 dark:border-slate-700/60 dark:bg-slate-900/50',
        'hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
        className
      )}
      {...props}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground dark:border-slate-700 dark:bg-slate-800">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-[15px] font-black leading-snug tracking-tight">
                <Link
                  href={href}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  aria-label={`عرض برنامج ${heading}`}
                >
                  {heading}
                </Link>
              </CardTitle>
              {program.company && <p className="truncate text-xs font-medium text-muted-foreground">{program.company}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {program.status && (
              <Badge
                variant={program.status === 'active' ? 'default' : 'secondary'}
                className="capitalize shadow-sm"
              >
                {program.status.replace(/_/g, ' ')}
              </Badge>
            )}
            {program.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold leading-none text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> موثقة
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Bounty + severity */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums',
              hasBounty
                ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-slate-200 bg-muted text-muted-foreground dark:border-slate-700'
            )}
          >
            <Coins className="h-3.5 w-3.5" />
            {hasBounty ? (
              <span dir="ltr">
                {program.minBounty != null ? `$${program.minBounty.toLocaleString()}` : '$0'} –{' '}
                {program.maxBounty != null ? `$${program.maxBounty.toLocaleString()}` : '∞'}
              </span>
            ) : (
              'Bounty TBD'
            )}
          </span>
          {program.severities?.slice(0, 3).map((s) => (
            <span
              key={s}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize',
                severityChip[s.toLowerCase()] ?? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800'
              )}
            >
              {s}
            </span>
          ))}
        </div>
        {program.tech && program.tech.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {program.tech.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[11px] uppercase tracking-wide">
                {t}
              </Badge>
            ))}
          </div>
        )}
        <Link
          href={href}
          aria-label={`عرض برنامج ${heading}`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold shadow-sm transition-all duration-150 hover:bg-accent hover:text-accent-foreground hover:shadow active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 group-hover:border-slate-300"
        >
          View program <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

export { ProgramCard };
export type { ProgramCardProps };
