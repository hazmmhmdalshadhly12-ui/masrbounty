import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ProgramsTableRow {
  id: string;
  name: string;
  company?: string;
  status: string;
  reportsCount?: number;
  href?: string;
}

interface ProgramsTableProps extends React.HTMLAttributes<HTMLDivElement> {
  programs?: ProgramsTableRow[];
  title?: string;
}

function ProgramsTable({ programs = [], title, className, ...props }: ProgramsTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-card-foreground', className)} {...props}>
      {title && <h3 className="border-b px-4 py-3 text-sm font-semibold">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-medium">Program</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Reports</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No programs found.
                </td>
              </tr>
            )}
            {programs.map((program) => {
              const href = program.href ?? `/programs/${program.id}`;
              return (
                <tr key={program.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={href} className="font-medium hover:underline">
                      {program.name}
                    </Link>
                    {program.company && (
                      <p className="text-xs text-muted-foreground">{program.company}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={program.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {program.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {program.reportsCount ?? '—'}
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

export { ProgramsTable };
export type { ProgramsTableProps };
