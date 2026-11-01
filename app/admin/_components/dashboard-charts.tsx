'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from 'recharts';

// Brand-aligned palette: Deep Navy / Professional Blue / Emerald / Amber / Neutral Gray
const COLORS = ['#0f172a', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#0891b2', '#7c3aed'];
const BLUE = '#2563eb';
const EMERALD = '#10b981';
const AMBER = '#f59e0b';

export function ReportsByStatusChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill={BLUE} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProgramsByStatusChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SeverityChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
        <Tooltip />
        <Bar dataKey="value" fill={AMBER} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyReportsChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke={EMERALD} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
