import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const severityBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize transition-colors',
  {
    variants: {
      severity: {
        critical: 'border-transparent bg-red-500/15 text-red-700 dark:text-red-400',
        high: 'border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-400',
        medium: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
        low: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        informational: 'border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-400',
        info: 'border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-400',
        none: 'border-input text-muted-foreground',
      },
    },
    defaultVariants: { severity: 'medium' },
  },
);

export interface SeverityBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof severityBadgeVariants>, 'severity'> {
  severity: string;
  title?: string;
}

function SeverityBadge({ severity, title, className, ...props }: SeverityBadgeProps) {
  const key = severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'informational' | 'info' | 'none';
  return (
    <span className={cn(severityBadgeVariants({ severity: key }), className)} {...props}>
      {title ?? severity}
    </span>
  );
}

export { SeverityBadge, severityBadgeVariants };
