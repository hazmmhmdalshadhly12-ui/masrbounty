import * as React from 'react';
import { cn } from '@/lib/utils';
import { StatCard, type StatCardProps } from '@/components/dashboard/stat-card';

export interface KpiItem extends Omit<StatCardProps, 'className'> {
  key?: string;
}

interface KpiRowProps extends React.HTMLAttributes<HTMLDivElement> {
  items: KpiItem[];
}

function KpiRow({ items, className, ...props }: KpiRowProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)} {...props}>
      {items.map((item, index) => (
        <StatCard key={item.key ?? index} {...item} />
      ))}
    </div>
  );
}

/** Legacy placeholder export retained so existing imports keep working. */
function Tmp() {
  return null;
}

export { KpiRow, Tmp };
export type { KpiRowProps };
