import type { Locale } from '@/types/index';

/**
 * ============================================================
 * SINGLE SOURCE OF TRUTH for report statuses, labels, and the
 * lifecycle transition map. Every UI surface, server action and
 * DB trigger must derive from this module — no ad-hoc status
 * arrays anywhere else (the old duplicated lists are gone).
 *
 * Lifecycle states (DB enum `report_status`):
 *   draft → submitted (New) → under_review / triaged / need_more_info
 *   → accepted | informative | duplicate | not_applicable | rejected | spam
 *   → reward_approved → paid (finance RPCs only)
 *   → resolved → closed
 * Reopen of closed reports is a staff-only override.
 * ============================================================
 */

export const REPORT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'need_more_info',
  'triaged',
  'informative',
  'duplicate',
  'not_applicable',
  'spam',
  'rejected',
  'accepted',
  'reward_approved',
  'paid',
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
  submitted: { ar: 'جديد', en: 'New' },
  under_review: { ar: 'قيد المراجعة', en: 'Under review' },
  need_more_info: { ar: 'معلومات مطلوبة', en: 'Need more info' },
  triaged: { ar: 'تم الفرز', en: 'Triaged' },
  informative: { ar: 'معلوماتي', en: 'Informative' },
  duplicate: { ar: 'مكرر', en: 'Duplicate' },
  not_applicable: { ar: 'غير منطبق', en: 'N/A' },
  spam: { ar: 'غير جاد', en: 'Spam' },
  rejected: { ar: 'مرفوض', en: 'Rejected' },
  accepted: { ar: 'مقبول', en: 'Accepted' },
  reward_approved: { ar: 'المكافأة معتمدة', en: 'Reward approved' },
  paid: { ar: 'مدفوع', en: 'Paid' },
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
  return REPORT_STATUS_LABELS[status]?.[locale] ?? status;
}

export function severityLabel(severity: Severity, locale: Locale = 'ar'): string {
  return SEVERITY_LABELS[severity]?.[locale] ?? severity;
}

/* ============================================================
 * LIFECYCLE TRANSITION MAP — mirrored 1:1 by the DB trigger
 * `fn_enforce_report_transitions` (migration 27). Keep both in
 * sync; tests assert the parity of the key rules.
 * ============================================================ */

export const REPORT_TRANSITIONS: Readonly<Record<ReportStatus, readonly ReportStatus[]>> = {
  draft: ['submitted'],
  submitted: ['under_review', 'triaged', 'need_more_info', 'accepted', 'informative', 'duplicate', 'not_applicable', 'rejected', 'spam', 'closed'],
  under_review: ['triaged', 'need_more_info', 'accepted', 'informative', 'duplicate', 'not_applicable', 'rejected', 'spam', 'closed'],
  need_more_info: ['under_review', 'triaged', 'accepted', 'informative', 'duplicate', 'not_applicable', 'rejected', 'spam', 'closed'],
  triaged: ['under_review', 'need_more_info', 'accepted', 'informative', 'duplicate', 'not_applicable', 'rejected', 'spam', 'resolved', 'closed'],
  accepted: ['reward_approved', 'resolved', 'closed'],
  reward_approved: ['paid', 'accepted'],
  rejected: ['closed'],
  informative: ['closed'],
  duplicate: ['closed'],
  not_applicable: ['closed'],
  spam: ['closed'],
  resolved: ['closed'],
  paid: ['closed'],
  closed: [],
};

/** Staff-only reopen target for closed reports. */
export const STAFF_REOPEN_TARGET: ReportStatus = 'under_review';

/**
 * Pure transition validator (same semantics as the DB trigger):
 * - same status is a no-op allow;
 * - `to === 'draft'` is never allowed (drafts are created, never re-entered);
 * - unknown source status is REJECTED (closes the old "unknown = allow" hole);
 * - closed reports reopen only via the staff override (`opts.staff`).
 */
export function canTransition(
  from: string,
  to: string,
  opts: { staff?: boolean } = {}
): boolean {
  if (from === to) return true;
  if (to === 'draft') return false;
  if (from === 'closed') return opts.staff === true && to === STAFF_REOPEN_TARGET;
  const next = REPORT_TRANSITIONS[from as ReportStatus];
  if (!next) return false;
  return (next as readonly string[]).includes(to);
}

/** All targets reachable from a given status (for building UI selects). */
export function allowedTransitions(from: string, opts: { staff?: boolean } = {}): ReportStatus[] {
  if (from === 'closed') return opts.staff ? [STAFF_REOPEN_TARGET] : [];
  const next = REPORT_TRANSITIONS[from as ReportStatus];
  return next ? [...next] : [];
}

/* ============================================================
 * SEMANTIC GROUPS
 * ============================================================ */

/** Terminal-ish states shown as "closed" work — no action expected. */
export const CLOSED_REPORT_STATUSES: readonly ReportStatus[] = [
  'resolved', 'closed', 'duplicate', 'informative', 'not_applicable', 'rejected', 'spam', 'paid',
];

/** Reports the company has NOT yet reviewed (the "New" bucket). */
export const UNREVIEWED_REPORT_STATUSES: readonly ReportStatus[] = ['submitted'];

/** Decisions that REQUIRE a written reason (server-enforced + DB-logged). */
export const REASON_REQUIRED_STATUSES: readonly ReportStatus[] = [
  'rejected', 'duplicate', 'not_applicable', 'spam',
];

/**
 * Statuses a company triager may set directly (finance states excluded —
 * they are set exclusively by the money RPCs).
 *
 * 'submitted' IS included: the company inbox can hold legacy reports stuck
 * in 'draft' (created before the P0 submit fix), and the detail page offers
 * draft → submitted as the intake action into the professional lifecycle.
 * This is safe because canTransition() permits 'submitted' ONLY from
 * 'draft' — a company can never "un-decide" a reviewed report back to New.
 * Removing it again reintroduces the production error boundary
 * (حدث خطأً ما) on the company report page.
 */
export const COMPANY_TRIAGE_STATUSES: readonly ReportStatus[] = [
  'submitted', 'under_review', 'need_more_info', 'triaged', 'informative', 'duplicate',
  'not_applicable', 'spam', 'rejected', 'accepted', 'resolved', 'closed',
];

/** Finance-driven report states (set exclusively by the money RPCs). */
export const FINANCE_REPORT_STATUSES: readonly ReportStatus[] = ['reward_approved', 'paid'];
