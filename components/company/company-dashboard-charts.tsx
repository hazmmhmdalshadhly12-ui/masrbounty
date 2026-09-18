'use client';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b',
  submitted: '#3b82f6',
  triaged: '#8b5cf6',
  accepted: '#10b981',
  resolved: '#059669',
  closed: '#475569',
  duplicate: '#f97316',
  informative: '#06b6d4',
  not_applicable: '#94a3b8',
};

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  informational: '#64748b',
  info: '#64748b',
};

export function ReportsByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تقارير بعد</p>;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="status" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis allowDecimals={false} fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? '#0f172a'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompanySeverityChart({ data }: { data: { severity: string; count: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">لا بيانات للخطورة</p>;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="severity" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((d, i) => (
              <Cell key={d.severity} fill={SEV_COLORS[d.severity] ?? `hsl(${220 + i * 18} 70% 50%)`} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
