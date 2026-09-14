'use client';

import type { LeaderboardEntry } from './types';

export function LeaderboardView({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Leaderboard is empty.</p>;
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Researcher</th>
            <th className="p-2 text-right">Score</th>
            <th className="p-2 text-right">Accepted</th>
            <th className="p-2 text-right">Earned</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.researcher_id} className="border-t">
              <td className="p-2">{e.rank}</td>
              <td className="p-2 font-medium">{e.display_name}</td>
              <td className="p-2 text-right">{e.score}</td>
              <td className="p-2 text-right">{e.accepted_reports}</td>
              <td className="p-2 text-right">{e.total_earned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
