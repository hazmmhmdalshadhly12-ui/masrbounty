import * as React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface RecentReport {
  id: string;
  title: string;
  severity: string;
  status: string;
  href?: string;
}

interface RecentReportsProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  reports?: RecentReport[];
}

const severityVariants: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-700 dark:text-red-400',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  low: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  informational: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
};

function RecentReports({ title = 'Latest reports', reports = [], className, ...props }: RecentReportsProps) {
  return (
    <Card className={cn('overflow-hidden', className)} {...props}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
        {reports.map((report) => (
          <div key={report.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0 flex-1">
              {report.href ? (
                <Link href={report.href} className="truncate text-sm font-medium hover:underline">
                  {report.title}
                </Link>
              ) : (
                <p className="truncate text-sm font-medium">{report.title}</p>
              )}
              <p className="text-xs capitalize text-muted-foreground">{report.status.replace(/_/g, ' ')}</p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
                severityVariants[report.severity.toLowerCase()] ?? 'bg-muted text-muted-foreground',
              )}
            >
              {report.severity}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { RecentReports };
export type { RecentReportsProps };
