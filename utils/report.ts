/**
 * Report status machine + severity presentation helpers. Pure functions.
 *
 * @deprecated as a source of truth — the canonical lifecycle lives in
 * `@/constants/statuses.ts` (single source shared by UI, server actions and
 * the DB trigger `fn_enforce_report_transitions`). This shim keeps the old
 * import path working and delegates everything to the canonical module.
 */
export {
  REPORT_STATUSES,
  SEVERITIES,
  allowedTransitions,
  canTransition,
  CLOSED_REPORT_STATUSES,
  REASON_REQUIRED_STATUSES,
} from '@/constants/statuses';

export type { ReportStatus } from '@/constants/statuses';

const BADGE: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  informational: 'bg-gray-500',
};

export const badgeColor = (s: string): string => BADGE[s] || 'bg-gray-500';

import { CLOSED_REPORT_STATUSES, SEVERITIES } from '@/constants/statuses';

/** Terminal states — no further transitions expected. */
export const isTerminalStatus = (s: string): boolean =>
  (CLOSED_REPORT_STATUSES as readonly string[]).includes(s) || s === 'closed';

export function severityRank(s: string): number {
  const i = (SEVERITIES as readonly string[]).indexOf(s);
  return i < 0 ? -1 : i;
}
