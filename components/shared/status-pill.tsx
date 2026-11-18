import { cn } from '@/lib/utils';

/*
 * Semantic status palette — every status key resolves to a design-token tint
 * (info / warning / success / destructive / primary / muted) so light & dark
 * themes stay in sync. Synonyms share a bucket:
 *   blue · sky · cyan      → info
 *   yellow · orange · amber→ warning
 *   green · emerald · teal → success
 *   red · rose             → destructive
 *   violet · purple        → primary
 *   zinc · slate · gray    → muted
 */
const INFO = 'bg-info/15 text-info ring-info/30';
const WARNING = 'bg-warning/15 text-warning ring-warning/30';
const SUCCESS = 'bg-success/15 text-success ring-success/30';
const DESTRUCTIVE = 'bg-destructive/15 text-destructive ring-destructive/30';
const PRIMARY = 'bg-primary/15 text-primary ring-primary/30';
const MUTED = 'bg-muted text-muted-foreground ring-border';

const statusStyles: Record<string, string> = {
  draft: MUTED,
  submitted: INFO,
  under_review: INFO,
  need_more_info: WARNING,
  triaged: PRIMARY,
  informative: INFO,
  duplicate: WARNING,
  not_applicable: MUTED,
  spam: MUTED,
  accepted: SUCCESS,
  reward_approved: SUCCESS,
  paid: SUCCESS,
  resolved: SUCCESS,
  closed: MUTED,
  active: SUCCESS,
  paused: WARNING,
  pending: WARNING,
  approved: SUCCESS,
  rejected: DESTRUCTIVE,
  completed: SUCCESS,
  failed: DESTRUCTIVE,
  open: INFO,
};

const severityStyles: Record<string, string> = {
  critical: DESTRUCTIVE,
  high: WARNING,
  medium: WARNING,
  low: INFO,
  informational: MUTED,
};

const ar: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'جديد',
  under_review: 'قيد المراجعة',
  need_more_info: 'معلومات مطلوبة',
  triaged: 'تم الفرز',
  informative: 'معلوماتي',
  duplicate: 'مكرر',
  not_applicable: 'غير منطبق',
  spam: 'غير جاد',
  accepted: 'مقبول',
  reward_approved: 'المكافأة معتمدة',
  paid: 'مدفوع',
  resolved: 'محلول',
  closed: 'مغلق',
  critical: 'حرجة',
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
  informational: 'معلوماتية',
  active: 'نشط',
  paused: 'موقوف',
  pending: 'معلق',
  approved: 'معتمد',
  rejected: 'مرفوض',
  completed: 'مكتمل',
  failed: 'فاشل',
  open: 'مفتوح',
  public: 'عام',
  private: 'خاص',
};

export function StatusPill({ value, kind = 'status' }: { value: string; kind?: 'status' | 'severity' }) {
  const styles = kind === 'severity' ? severityStyles : statusStyles;
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        styles[value] ?? MUTED
      )}
    >
      {ar[value] ?? value}
    </span>
  );
}
