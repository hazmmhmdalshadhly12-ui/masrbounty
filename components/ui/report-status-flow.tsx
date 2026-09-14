import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const REPORT_STATUSES = [
  'draft',
  'submitted',
  'triaged',
  'accepted',
  'resolved',
  'closed',
] as const;

export type ReportStatusFlowStatus = (typeof REPORT_STATUSES)[number] | string;

interface ReportStatusFlowProps extends React.OlHTMLAttributes<HTMLOListElement> {
  status: ReportStatusFlowStatus;
  steps?: string[];
}

function normalizeStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'informative' || s === 'duplicate' || s === 'not_applicable') return 'triaged';
  return s;
}

function ReportStatusFlow({ status, steps, className, ...props }: ReportStatusFlowProps) {
  const flowSteps = steps ?? [...REPORT_STATUSES];
  const current = normalizeStatus(status);
  const currentIndex = Math.max(
    0,
    flowSteps.findIndex((s) => normalizeStatus(s) === current),
  );
  return (
    <ol dir="ltr" className={cn('flex w-full items-center', className)} {...props}>
      {flowSteps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step} className={cn('flex items-center', index < flowSteps.length - 1 && 'flex-1')}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary bg-background text-primary ring-2 ring-primary/20',
                  !done && !active && 'border-input bg-background text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-xs font-medium capitalize',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.replace(/_/g, ' ')}
              </span>
            </div>
            {index < flowSteps.length - 1 && (
              <div className={cn('mx-2 h-px flex-1', index < currentIndex ? 'bg-primary' : 'bg-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { ReportStatusFlow };
export type { ReportStatusFlowProps };
