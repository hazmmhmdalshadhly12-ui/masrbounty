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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface EarningsDatum {
  month?: string;
  label?: string;
  total?: number;
  value?: number;
}

interface EarningsChartProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  data?: EarningsDatum[];
}

function EarningsChart({ title = 'Earnings', data = [], className, ...props }: EarningsChartProps) {
  const normalized = data.map((d) => ({
    month: d.month ?? d.label ?? '',
    total: d.total ?? d.value ?? 0,
  }));
  return (
    <Card className={cn('overflow-hidden', className)} {...props}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {normalized.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No earnings yet.</p>
        ) : (
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={normalized} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background))',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Earnings"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { EarningsChart };
export type { EarningsChartProps };
