'use client';

import type { HallOfFameEntry } from './types';

export function HallOfFameView({ entries }: { entries: HallOfFameEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">Hall of fame is empty</p>
        <p className="text-sm text-muted-foreground">Recognized researchers will appear here.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map((e) => (
        <div key={e.id} className="rounded-lg border p-4">
          <p className="font-medium">{e.display_name}</p>
          <p className="text-sm">{e.achievement}</p>
          <p className="mt-1 text-xs text-muted-foreground">{new Date(e.recognized_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
