'use client';

import type { SearchHit } from './types';

export function SearchView({ hits }: { hits: SearchHit[] }) {
  if (hits.length === 0) return <p className="text-sm text-muted-foreground">No results. Try a longer query.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {hits.map((h) => (
        <li key={`${h.kind}-${h.id}`} className="p-3 text-sm">
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{h.kind}</span>{' '}
          <span className="font-medium">
            {h.kind === 'program' ? h.name : h.kind === 'report' ? `${h.report_number} · ${h.title}` : h.display_name}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SearchEmpty() {
  return <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>;
}
