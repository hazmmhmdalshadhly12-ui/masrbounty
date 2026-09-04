'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#64748b', '#3b82f6', '#eab308', '#f97316', '#ef4444'];

export interface SeverityDatum {
  severity: string;
  count: number;
}

export function SeverityChart({ data }: { data: SeverityDatum[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No data.</p>;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="severity" outerRadius={90} label>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
