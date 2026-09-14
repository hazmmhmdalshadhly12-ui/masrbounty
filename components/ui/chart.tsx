'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChartConfig {
  [key: string]: { label?: string; color?: string };
}

interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: ChartConfig;
}

function ChartContainer({ config, className, children, ...props }: ChartProps) {
  const style = React.useMemo(() => {
    if (!config) return undefined;
    const entries = Object.entries(config);
    if (entries.length === 0) return undefined;
    return {
      ...Object.fromEntries(entries.map(([key, value]) => [`--color-${key}`, value.color ?? ''])),
    } as React.CSSProperties;
  }, [config]);

  return (
    <div
      data-chart="chart"
      style={style}
      className={cn('flex aspect-video w-full justify-center text-foreground', className)}
      {...props}
    >
      {children}
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: string | number; color?: string; dataKey?: string | number }>;
  label?: string;
  className?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn('rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-md', className)}>
      {label != null && <p className="mb-1 font-medium">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? 'hsl(var(--primary))' }}
            />
            <span>{entry.name}</span>
            <span className="font-mono font-medium tabular-nums text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartLegendContent({
  payload,
  className,
}: {
  payload?: Array<{ value?: string; color?: string }>;
  className?: string;
}) {
  if (!payload?.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-4 pt-3 text-sm', className)}>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? 'hsl(var(--primary))' }}
          />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

/** Backwards-compatible simple wrapper kept under the legacy `Chart` export name. */
function Chart({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full text-foreground', className)} {...props} />;
}

export { Chart, ChartContainer, ChartTooltipContent, ChartLegendContent };
export type { ChartProps };
