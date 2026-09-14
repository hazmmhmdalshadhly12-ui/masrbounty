import type { Severity } from './statuses';

export const SEVERITY_BOUNTY: Record<Severity, readonly [min: number, max: number]> = {
  informational: [0, 0],
  low: [25, 100],
  medium: [100, 500],
  high: [500, 2000],
  critical: [2000, 10000],
} as const;

export const REPUTATION: Record<'accepted' | 'resolved' | 'critical' | 'high', number> = {
  accepted: 10,
  resolved: 20,
  critical: 50,
  high: 20,
} as const;

export const MIN_PAYOUT_DEFAULT = 50;
export const PLATFORM_FEE_DEFAULT_PCT = 10;

export function bountyRange(severity: Severity): readonly [min: number, max: number] {
  return SEVERITY_BOUNTY[severity];
}

export function formatEgp(amount: number): string {
  return `${amount.toLocaleString('ar-EG')} جنيه`;
}
