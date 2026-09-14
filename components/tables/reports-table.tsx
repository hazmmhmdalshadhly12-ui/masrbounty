import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SeverityBadge } from '@/components/reports/severity-badge';
import { Badge } from '@/components/ui/badge';

export interface ReportsTableRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  program?: string;
  href?: string;
}

interface ReportsTableProps extends React.HTMLAttributes<HTMLDivElement> {
  reports?: ReportsTableRow[];
  title?: string;
}

function ReportsTable({ reports = [], title, className, ...props }: ReportsTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-card-foreground', className)} {...props}>
      {title && <h3 className="border-b px-4 py-3 text-sm font-semibold">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-medium">Report</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No reports found.
                </td>
              </tr>
            )}
            {reports.map((report) => {
              const href = report.href ?? `/reports/${report.id}`;
              return (
                <tr key={report.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={href} className="font-medium hover:underline">
                      {report.title}
                    </Link>
                    {report.program && (
                      <p className="text-xs text-muted-foreground">{report.program}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={report.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="capitalize">
                      {report.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { ReportsTable };
export type { ReportsTableProps };
