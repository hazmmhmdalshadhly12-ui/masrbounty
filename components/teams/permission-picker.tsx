'use client';

import { useState } from 'react';

export interface PermissionOption {
  key: string;
  label: string;
  /** permission is part of the selected role's defaults (shown pre-checked) */
  defaultFor?: boolean;
}

/**
 * Granular permission checkboxes — used by invitation + member editing dialogs
 * for both company and researcher-team catalogs. The server re-validates every
 * grant; this picker is convenience, not authorization.
 */
export function PermissionPicker({
  options,
  name = 'grant',
  initialSelected,
}: {
  options: PermissionOption[];
  name?: string;
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected ?? []));
  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <div className="grid gap-1.5 sm:grid-cols-2" role="group" aria-label="الصلاحيات التفصيلية">
      {options.map((o) => (
        <label
          key={o.key}
          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            selected.has(o.key)
              ? 'border-primary/40 bg-primary/5 font-medium'
              : 'bg-card hover:bg-muted/50'
          }`}
        >
          <input
            type="checkbox"
            name={name}
            value={o.key}
            checked={selected.has(o.key)}
            onChange={() => toggle(o.key)}
            className="h-3.5 w-3.5 shrink-0"
          />
          <span className="truncate">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/** Effective-permission chips for member rows. */
export function PermissionChips({ labels }: { labels: string[] }) {
  if (!labels.length) return <span className="text-xs text-muted-foreground">صلاحيات الدور الافتراضية</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {l}
        </span>
      ))}
    </span>
  );
}
