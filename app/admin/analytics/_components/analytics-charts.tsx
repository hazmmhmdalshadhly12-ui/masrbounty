'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/** Daily signup trend over the selected range (day buckets, oldest first). */
export function SignupsTrendChart({ data }: { data: Array<{ label: string; count: number }> }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, left: 0, right: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} minTickGap={18} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
        <Tooltip />
        <Area type="monotone" dataKey="count" name="اشتراكات" stroke="#f59e0b" strokeWidth={2} fill="url(#signupsFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
