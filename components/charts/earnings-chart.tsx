'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export interface EarningDatum {
  month: string;
  total: number;
}

export function EarningsChart({ data }: { data: EarningDatum[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No earnings yet.</p>;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Area type="monotone" dataKey="total" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
