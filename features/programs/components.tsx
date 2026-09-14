'use client';

import type { Program } from './types';

export function ProgramsView({ programs }: { programs: Program[] }) {
  if (programs.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">No programs found</p>
        <p className="text-sm text-muted-foreground">Check back later or adjust filters.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {programs.map((p) => (
        <div key={p.id} className="rounded-lg border p-4">
          <p className="font-bold">{p.name}</p>
          <p className="text-sm text-muted-foreground">/{p.slug}</p>
          <p className="mt-2 line-clamp-3 text-sm">{p.description}</p>
          <p className="mt-2 text-xs">
            <span className="rounded bg-muted px-2 py-0.5">{p.status}</span>{' '}
            <span className="rounded bg-muted px-2 py-0.5">{p.visibility}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

export function ProgramCard({ program }: { program: Program }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="font-bold">{program.name}</p>
      <p className="text-sm text-muted-foreground">{program.scope}</p>
    </div>
  );
}
