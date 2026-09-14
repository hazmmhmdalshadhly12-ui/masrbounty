'use client';

import type { ReputationWithStats } from './types';

export function ReputationView({ items }: { items: ReputationWithStats[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No reputation data yet.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((r) => (
        <li key={r.id} className="flex items-center justify-between p-3 text-sm">
          <span className="font-medium">{r.display_name ?? r.researcher_id.slice(0, 8)}</span>
          <span>
            Score <strong>{r.score}</strong>
            {r.rank != null ? ` · Rank #${r.rank}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReputationBadge({ score }: { score: number }) {
  const level = score >= 500 ? 'Elite' : score >= 200 ? 'Pro' : score >= 50 ? 'Rising' : 'Newcomer';
  return <span className="rounded bg-muted px-2 py-0.5 text-xs">{level} · {score} pts</span>;
}
