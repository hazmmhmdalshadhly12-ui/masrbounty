import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2 } from 'lucide-react';
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
}

interface ProgramCardProps extends React.HTMLAttributes<HTMLDivElement> {
  program: ProgramCardData;
  title?: string;
}

function ProgramCard({ program, title, className, ...props }: ProgramCardProps) {
  const heading = title ?? program.name;
  const href = program.href ?? `/programs/${program.id}`;
  return (
    <Card className={cn('overflow-hidden transition-colors hover:border-slate-400 focus-within:ring-2 focus-within:ring-ring', className)} {...props}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-base leading-snug">
                <Link href={href} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1" aria-label={`عرض برنامج ${heading}`}>
                  {heading}
                </Link>
              </CardTitle>
              {program.company && (
                <p className="truncate text-xs text-muted-foreground">{program.company}</p>
              )}
            </div>
          </div>
          {program.status && (
            <Badge variant={program.status === 'active' ? 'default' : 'secondary'} className="shrink-0 capitalize">
              {program.status.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <p className="text-sm tabular-nums text-muted-foreground">
          {program.minBounty != null || program.maxBounty != null ? (
            <>
              ${program.minBounty?.toLocaleString() ?? 0} – ${program.maxBounty?.toLocaleString() ?? 0}
            </>
          ) : (
            'Bounty TBD'
          )}
        </p>
        <Link
          href={href}
          aria-label={`عرض برنامج ${heading}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          View program <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

export { ProgramCard };
export type { ProgramCardProps };
