import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'new', label: 'جديد', match: ['draft', 'submitted'] },
  { key: 'triaged', label: 'فرز', match: ['triaged', 'informative'] },
  { key: 'accepted', label: 'قبول', match: ['accepted', 'duplicate', 'not_applicable'] },
  { key: 'resolved', label: 'حل ومكافأة', match: ['resolved', 'closed'] },
];

export function ReportStepper({ status }: { status: string }) {
  const active = Math.max(
    0,
    STAGES.findIndex((s) => s.match.includes(status))
  );
  return (
    <ol className="flex items-center gap-0" dir="rtl">
      {STAGES.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-black',
                i < active && 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
                i === active && 'bg-amber-400 text-slate-950',
                i > active && 'bg-muted text-muted-foreground'
              )}
            >
              {i + 1}
            </span>
            <span className={cn('text-[11px]', i === active ? 'font-bold' : 'text-muted-foreground')}>{s.label}</span>
          </div>
          {i < STAGES.length - 1 && <span className={cn('mx-1 h-px flex-1', i < active ? 'bg-slate-900 dark:bg-slate-100' : 'bg-border')} />}
        </li>
      ))}
    </ol>
  );
}
