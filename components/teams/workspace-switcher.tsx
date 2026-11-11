'use client';

import { Users, Building2, User, LayoutDashboard, ChevronsUpDown } from 'lucide-react';

export interface WorkspaceOption {
  kind: 'personal' | 'member' | 'researcher_team' | 'company';
  label: string;
  sublabel?: string;
  href: string;
  active?: boolean;
}

function Icon({ k }: { k: WorkspaceOption['kind'] }) {
  const cls = 'h-4 w-4 shrink-0';
  if (k === 'company') return <Building2 className={cls} />;
  if (k === 'researcher_team') return <Users className={cls} />;
  if (k === 'member') return <LayoutDashboard className={cls} />;
  return <User className={cls} />;
}

/**
 * Workspace switcher — native details/summary dropdown (no modal dependency).
 * Navigation only: every destination re-derives permissions server-side, so
 * switching spaces can never elevate access.
 */
export function WorkspaceSwitcher({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const active = workspaces.find((w) => w.active) ?? workspaces[0];
  return (
    <details className="group relative">
      <summary
        className="flex h-9 max-w-[260px] cursor-pointer list-none items-center gap-2 rounded-md border bg-card px-3 text-xs shadow-sm hover:bg-muted/60 [&::-webkit-details-marker]:hidden"
        aria-label="تبديل مساحة العمل"
      >
        <Icon k={active?.kind ?? 'personal'} />
        <span className="truncate font-medium">{active?.label ?? 'حسابي الشخصي'}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </summary>
      <div className="absolute z-40 mt-1 w-64 rounded-lg border bg-popover p-1 shadow-lg" dir="rtl">
        <p className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground">مساحات العمل</p>
        {workspaces.map((w) => (
          <a
            key={w.href}
            href={w.href}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${w.active ? 'bg-muted' : ''}`}
          >
            <Icon k={w.kind} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{w.label}</span>
              {w.sublabel && <span className="truncate text-[11px] text-muted-foreground">{w.sublabel}</span>}
            </span>
            {w.active && <span className="mr-auto text-[10px] font-bold text-primary">الحالية</span>}
          </a>
        ))}
      </div>
    </details>
  );
}
