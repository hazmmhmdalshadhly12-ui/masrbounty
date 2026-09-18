'use client';

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  informational: '#64748b',
  info: '#64748b',
};
const PIE_FALLBACK = ['#64748b', '#3b82f6', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4'];

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{msg}</p>;
}

export function ReportsPerMonthChart({ data }: { data: { month: string; total: number }[] }) {
  if (!data.length) return <Empty msg="لا توجد تقارير بعد" />;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="month" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis allowDecimals={false} fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--card-foreground))' }}
          />
          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeverityDistChart({ data }: { data: { severity: string; count: number }[] }) {
  if (!data.length) return <Empty msg="لا بيانات للخطورة" />;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="severity" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((d, i) => (
              <Cell key={d.severity} fill={SEV_COLORS[d.severity] ?? PIE_FALLBACK[i % PIE_FALLBACK.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BountySpendingChart({ data }: { data: { month: string; total: number }[] }) {
  if (!data.length) return <Empty msg="لا يوجد إنفاق بعد" />;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="month" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v: number) => [`${v.toLocaleString()} EGP`, 'الإنفاق']} />
          <Area type="monotone" dataKey="total" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" fillOpacity={0.25} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AvgResolutionChart({ data }: { data: { month: string; hours: number; count: number }[] }) {
  if (!data.length) return <Empty msg="لا توجد تقارير محلولة بعد" />;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="month" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} unit="h" />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v: unknown) => [`${String(v)} ساعة`, 'متوسط الحل'] as unknown as string} />
          <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
