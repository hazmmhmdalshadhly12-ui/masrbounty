'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface WalletChartDatum {
  label: string;
  balance: number;
  pending?: number;
}

interface WalletChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: WalletChartDatum[];
  emptyMessage?: string;
}

function WalletChart({ data, emptyMessage = 'No wallet activity yet.', className, ...props }: WalletChartProps) {
  if (data.length === 0) {
    return <p className={cn('py-8 text-center text-sm text-muted-foreground', className)}>{emptyMessage}</p>;
  }
  return (
    <div className={cn('h-64 w-full', className)} dir="ltr" {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}`} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--background))',
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="pending"
            name="Pending"
            stroke="hsl(var(--muted-foreground))"
            fill="hsl(var(--muted-foreground))"
            fillOpacity={0.15}
            strokeDasharray="4 4"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export { WalletChart };
export type { WalletChartProps };
