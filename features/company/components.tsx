'use client';

import type { CompanyMember, CompanyProfile } from './types';

export function CompanyView({ company }: { company: CompanyProfile | null }) {
  if (!company) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">No company profile yet</p>
        <p className="text-sm text-muted-foreground">Create a company profile to launch programs.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-4">
      <p className="text-lg font-bold">{company.name}</p>
      <p className="text-sm text-muted-foreground">/{company.slug}</p>
      {company.description && <p className="mt-2 text-sm">{company.description}</p>}
      {company.is_verified && <p className="mt-1 text-sm text-green-600">Verified</p>}
    </div>
  );
}

export function CompanyMemberList({ members }: { members: CompanyMember[] }) {
  if (members.length === 0) return <p className="text-sm text-muted-foreground">No team members yet.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {members.map((m) => (
        <li key={m.id} className="flex items-center justify-between p-3 text-sm">
          <span>{m.profile?.username ?? m.user_id}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{m.role}</span>
        </li>
      ))}
    </ul>
  );
}
