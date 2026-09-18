import { Badge } from '@/components/ui/badge';
import { getSLAStatus, slaIcon, slaLabel, type SLAReport } from '@/lib/sla';
import { cn } from '@/lib/utils';

export function SLABadge({ report, now }: { report: SLAReport; now?: Date }) {
  const status = getSLAStatus(report, now);
  const icon = slaIcon(status);
  const label = slaLabel(status);
  const variant = status === 'overdue' ? 'destructive' : status === 'at_risk' ? 'outline' : 'secondary';
  return (
    <Badge variant={variant as never} className={cn(status === 'at_risk' && 'border-amber-500 text-amber-700')}>
      <span className="me-1">{icon}</span> SLA — {label}
    </Badge>
  );
}

export function SLAIndicator({ report, now }: { report: SLAReport; now?: Date }) {
  const status = getSLAStatus(report, now);
  const icon = slaIcon(status);
  const title = slaLabel(status);
  return (
    <span title={title} aria-label={title} className="inline-flex items-center gap-1 text-xs">
      <span>{icon}</span>
      <span className="hidden sm:inline text-muted-foreground">{title}</span>
    </span>
  );
}
