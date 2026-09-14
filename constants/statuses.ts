import type { Locale } from '@/types/index';

export const REPORT_STATUSES = [
  'draft',
  'submitted',
  'triaged',
  'informative',
  'duplicate',
  'not_applicable',
  'accepted',
  'resolved',
  'closed',
] as const;

export const SEVERITIES = ['informational', 'low', 'medium', 'high', 'critical'] as const;

export const PROGRAM_STATUSES = ['draft', 'pending_review', 'active', 'paused', 'closed'] as const;

export const PROGRAM_VISIBILITIES = ['public', 'private'] as const;

export const PAYOUT_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'processing',
  'completed',
  'failed',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  submitted: { ar: 'مُرسَل', en: 'Submitted' },
  triaged: { ar: 'قيد الفرز', en: 'Triaged' },
  informative: { ar: 'معلوماتي', en: 'Informative' },
  duplicate: { ar: 'مكرر', en: 'Duplicate' },
  not_applicable: { ar: 'غير منطبق', en: 'N/A' },
  accepted: { ar: 'مقبول', en: 'Accepted' },
  resolved: { ar: 'تم حله', en: 'Resolved' },
  closed: { ar: 'مغلق', en: 'Closed' },
};

export const SEVERITY_LABELS: Record<Severity, { ar: string; en: string }> = {
  informational: { ar: 'معلوماتية', en: 'Informational' },
  low: { ar: 'منخفضة', en: 'Low' },
  medium: { ar: 'متوسطة', en: 'Medium' },
  high: { ar: 'عالية', en: 'High' },
  critical: { ar: 'حرجة', en: 'Critical' },
};

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  pending_review: { ar: 'بانتظار المراجعة', en: 'Pending review' },
  active: { ar: 'نشط', en: 'Active' },
  paused: { ar: 'متوقف مؤقتًا', en: 'Paused' },
  closed: { ar: 'مغلق', en: 'Closed' },
};

export function statusLabel(status: ReportStatus, locale: Locale = 'ar'): string {
  return REPORT_STATUS_LABELS[status][locale];
}

export function severityLabel(severity: Severity, locale: Locale = 'ar'): string {
  return SEVERITY_LABELS[severity][locale];
}

/** Terminal states — no further transitions expected. */
export const CLOSED_REPORT_STATUSES: readonly ReportStatus[] = ['resolved', 'closed', 'duplicate', 'informative', 'not_applicable'];
