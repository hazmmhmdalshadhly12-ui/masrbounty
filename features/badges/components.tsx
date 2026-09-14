'use client';

import type { Badge, ResearcherBadge } from './types';

export function BadgesView({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return <p className="text-sm text-muted-foreground">No badges defined yet.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {badges.map((b) => (
        <div key={b.id} className="rounded-lg border p-4">
          <p className="text-2xl">{b.icon ?? '🏅'}</p>
          <p className="font-medium">{b.name_en}</p>
          <p className="text-sm text-muted-foreground">{b.description_en ?? b.code}</p>
        </div>
      ))}
    </div>
  );
}

export function ResearcherBadgeList({ items }: { items: ResearcherBadge[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No badges earned yet.</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((rb) => (
        <li key={rb.id} className="rounded-lg border p-3 text-sm">
          <span className="font-medium">{rb.badge?.name_en ?? rb.badge_id}</span>
          <span className="block text-muted-foreground">{new Date(rb.awarded_at).toLocaleDateString()}</span>
        </li>
      ))}
    </ul>
  );
}
