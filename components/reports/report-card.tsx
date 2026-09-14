import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeverityBadge } from '@/components/reports/severity-badge';

export interface ReportCardData {
  id: string;
  title: string;
  severity: string;
  status: string;
  program?: string;
  createdAt?: string;
  href?: string;
}

interface ReportCardProps extends React.HTMLAttributes<HTMLDivElement> {
  report: ReportCardData;
  title?: string;
}

function ReportCard({ report, title, className, ...props }: ReportCardProps) {
  const heading = title ?? report.title;
  const href = report.href ?? `/reports/${report.id}`;
  return (
    <Card className={cn('overflow-hidden transition-colors hover:border-slate-400', className)} {...props}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base leading-snug">
            <Link href={href} className="hover:underline">
              {heading}
            </Link>
          </CardTitle>
          <SeverityBadge severity={report.severity} className="shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-2">
          {report.program && <span className="truncate font-medium">{report.program}</span>}
          <span className="shrink-0 capitalize">• {report.status.replace(/_/g, ' ')}</span>
          {report.createdAt && <span className="hidden shrink-0 sm:inline">• {report.createdAt}</span>}
        </span>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground hover:underline"
        >
          View <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

export { ReportCard };
export type { ReportCardProps };
