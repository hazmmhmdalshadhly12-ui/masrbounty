/** Report status machine + severity presentation helpers. Pure functions. */

export const REPORT_STATUSES = [
  'draft',
  'submitted',
  'triaging',
  'accepted',
  'rejected',
  'duplicate',
  'resolved',
  'closed',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SEVERITIES = ['informational', 'low', 'medium', 'high', 'critical'] as const;

const BADGE: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  informational: 'bg-gray-500',
};

export const badgeColor = (s: string): string => BADGE[s] || 'bg-gray-500';

const TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted', 'closed'],
  submitted: ['triaging', 'duplicate', 'rejected', 'closed'],
  triaging: ['accepted', 'rejected', 'duplicate', 'closed'],
  accepted: ['resolved', 'closed'],
  rejected: ['closed'],
  duplicate: ['closed'],
  resolved: ['closed'],
  closed: ['closed'],
};

export function allowedTransitions(from: string): string[] {
  return TRANSITIONS[from] ? [...(TRANSITIONS[from] as string[])] : [];
}

/** Closed reports are terminal (may only stay closed); same-status is a no-op allow. */
export const canTransition = (from: string, to: string): boolean => {
  if (from === to) return true;
  if (from === 'closed') return false;
  const next = TRANSITIONS[from];
  if (!next) return true;
  return next.includes(to);
};

export const isTerminalStatus = (s: string): boolean => s === 'closed' || s === 'resolved';

export function severityRank(s: string): number {
  const i = (SEVERITIES as readonly string[]).indexOf(s);
  return i < 0 ? -1 : i;
}
