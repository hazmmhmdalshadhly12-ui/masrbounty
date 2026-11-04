import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-amber-400 shadow-card dark:bg-amber-400 dark:text-navy-900">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight">{title}</h1>
          {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
