export const SLA_HOURS = {
  response: 24,
  triage: 72,
  resolution: 336, // 14d
} as const;

export type SLAKind = keyof typeof SLA_HOURS;
export type SLAStatus = 'on_time' | 'at_risk' | 'overdue' | 'fulfilled' | 'pending';

export interface SLAReport {
  status: string;
  created_at: string;
  submitted_at: string | null;
  updated_at?: string;
  severity?: string;
  resolved_at?: string | null;
}

const TERMINAL = new Set(['resolved', 'closed', 'duplicate', 'not_applicable', 'informative']);
const TRIAGED = new Set(['triaged', 'accepted', 'resolved', 'closed']);

function baseTime(report: SLAReport): number | null {
  if (report.submitted_at) return new Date(report.submitted_at).getTime();
  // fallback to created_at if no submitted_at (e.g draft that became submitted)
  if (report.created_at) {
    const t = new Date(report.created_at).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

export function getDueDate(report: SLAReport, kind: SLAKind = 'resolution'): Date | null {
  const base = baseTime(report);
  if (base === null || Number.isNaN(base)) return null;
  // draft reports have no SLA
  if (report.status === 'draft') return null;
  const hours = SLA_HOURS[kind];
  return new Date(base + hours * 3600 * 1000);
}

/**
 * Main due date for inbox sorting/badging.
 * - submitted => response SLA (24h) is most urgent
 * - triaged/accepted => triage SLA (72h)
 * - otherwise => resolution (14d)
 * If terminal, return null (fulfilled).
 */
export function getPrimaryDueDate(report: SLAReport): Date | null {
  if (TERMINAL.has(report.status)) return null;
  if (report.status === 'draft') return null;
  const base = baseTime(report);
  if (base === null) return null;
  if (report.status === 'submitted') return new Date(base + SLA_HOURS.response * 3600 * 1000);
  if (TRIAGED.has(report.status)) {
    // if still not resolved, triage overdue check already passed, now resolution
    // Use resolution as primary after triaged, but expose earlier kinds via helpers
    return new Date(base + SLA_HOURS.resolution * 3600 * 1000);
  }
  return new Date(base + SLA_HOURS.triage * 3600 * 1000);
}

export function getSLAStatus(report: SLAReport, now: Date = new Date()): SLAStatus {
  if (report.status === 'draft') return 'pending';
  if (TERMINAL.has(report.status)) return 'fulfilled';
  const base = baseTime(report);
  if (base === null) return 'pending';
  const nowMs = now.getTime();

  // Determine relevant SLA kind
  let kind: SLAKind = 'triage';
  if (report.status === 'submitted') kind = 'response';
  else if (TRIAGED.has(report.status)) kind = 'resolution';

  const due = getDueDate(report, kind);
  if (!due) return 'pending';
  const dueMs = due.getTime();
  const slaMs = SLA_HOURS[kind] * 3600 * 1000;
  const remaining = dueMs - nowMs;

  if (remaining <= 0) return 'overdue';
  // at risk when <25% remaining
  if (remaining < slaMs * 0.25) return 'at_risk';
  return 'on_time';
}

export function isOverdue(report: SLAReport, now: Date = new Date()): boolean {
  return getSLAStatus(report, now) === 'overdue';
}

export function slaLabel(status: SLAStatus): string {
  switch (status) {
    case 'on_time': return 'ضمن المهلة';
    case 'at_risk': return 'قارب الانتهاء';
    case 'overdue': return 'متجاوز';
    case 'fulfilled': return 'منجز';
    case 'pending': return 'مسودة';
    default: return status;
  }
}

export function slaIcon(status: SLAStatus): string {
  switch (status) {
    case 'on_time': return '🟢';
    case 'at_risk': return '🟡';
    case 'overdue': return '🔴';
    case 'fulfilled': return '✅';
    case 'pending': return '⚪';
    default: return '⚪';
  }
}

export function formatDueDate(due: Date | null): string {
  if (!due) return '—';
  return due.toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function hoursRemaining(report: SLAReport, kind: SLAKind = 'resolution', now: Date = new Date()): number | null {
  const due = getDueDate(report, kind);
  if (!due) return null;
  return (due.getTime() - now.getTime()) / 3_600_000;
}
