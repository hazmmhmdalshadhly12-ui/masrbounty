'use client';

import { useCountUp } from '@/hooks/use-count-up';

export function HeroStats({ stats }: { stats: [string, string][] }) {
  return (
    <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
      {stats.map(([n, label]) => (
        <StatCell key={label} n={Number(n) || 0} label={label} />
      ))}
    </dl>
  );
}

function StatCell({ n, label }: { n: number; label: string }) {
  const { ref, value } = useCountUp(n);
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-3xl font-black tabular-nums">
        <span ref={ref}>{value}</span>
      </dd>
      <dd className="mt-1 text-sm text-slate-400">{label}</dd>
    </div>
  );
}
