import type { LedgerSide } from '@/types/legal';

/**
 * Pure ledger builders — the TypeScript mirror of the balanced entries the
 * SQL RPCs write into financial_ledger_entries. Used by unit tests to prove
 * the balancing invariant (sum of debits == sum of credits per transaction)
 * and by docs. Money movement itself happens ONLY inside the SQL RPCs.
 */

const companyAvailable = (companyId: string) => `company_available:${companyId}`;
const companyReserved = (companyId: string) => `company_reserved:${companyId}`;

export function accountKey(type: 'company_available' | 'company_reserved', companyId: string): string {
  return type === 'company_available' ? companyAvailable(companyId) : companyReserved(companyId);
}

/** T1 — deposit approved (amount A): company_available <- external:funding */
export function depositEntries(companyId: string, amountMinor: number, description = 'إيداع معتمد'): LedgerSide[] {
  return [
    { account_key: companyAvailable(companyId), account_type: 'company_available', entity_id: companyId, entry_type: 'debit', amount_minor: amountMinor, description },
    { account_key: 'external:funding', account_type: 'external', entity_id: null, entry_type: 'credit', amount_minor: amountMinor, description },
  ];
}

/** T2 — reward approved (total T = reward R + commission C):
 *  available -> reserved (company holds the money until payout). */
export function rewardHoldEntries(companyId: string, totalMinor: number, description = 'حجز مكافأة'): LedgerSide[] {
  return [
    { account_key: companyReserved(companyId), account_type: 'company_reserved', entity_id: companyId, entry_type: 'debit', amount_minor: totalMinor, description },
    { account_key: companyAvailable(companyId), account_type: 'company_available', entity_id: companyId, entry_type: 'credit', amount_minor: totalMinor, description },
  ];
}

/** T3 — payout paid (T = R + C): reserved is consumed into platform
 *  commission (C) + external researcher payment (R). Σdebit = T = Σcredit. */
export function payoutPaidEntries(
  companyId: string,
  totalMinor: number,
  commissionMinor: number,
  rewardMinor: number
): LedgerSide[] {
  return [
    { account_key: companyReserved(companyId), account_type: 'company_reserved', entity_id: companyId, entry_type: 'debit', amount_minor: totalMinor, description: 'صرف المكافأة' },
    { account_key: 'platform_revenue', account_type: 'platform_revenue', entity_id: null, entry_type: 'credit', amount_minor: commissionMinor, description: 'عمولة المنصة' },
    { account_key: 'external:payouts', account_type: 'external', entity_id: null, entry_type: 'credit', amount_minor: rewardMinor, description: 'دفعة خارجية للباحث' },
  ];
}

/** T4 — payout failed/cancelled: reservation returns to available. */
export function payoutRefundEntries(companyId: string, totalMinor: number): LedgerSide[] {
  return [
    { account_key: companyAvailable(companyId), account_type: 'company_available', entity_id: companyId, entry_type: 'debit', amount_minor: totalMinor, description: 'إرجاع الحجز' },
    { account_key: companyReserved(companyId), account_type: 'company_reserved', entity_id: companyId, entry_type: 'credit', amount_minor: totalMinor, description: 'فك حجز المكافأة' },
  ];
}

/** T5 — admin adjustment (+credit / -debit against external:adjustment). */
export function adjustmentEntries(companyId: string, signedAmountMinor: number, note: string): LedgerSide[] {
  const abs = Math.abs(signedAmountMinor);
  return signedAmountMinor > 0
    ? [
        { account_key: companyAvailable(companyId), account_type: 'company_available', entity_id: companyId, entry_type: 'debit', amount_minor: abs, description: note },
        { account_key: 'external:adjustment', account_type: 'external', entity_id: null, entry_type: 'credit', amount_minor: abs, description: note },
      ]
    : [
        { account_key: 'external:adjustment', account_type: 'external', entity_id: null, entry_type: 'debit', amount_minor: abs, description: note },
        { account_key: companyAvailable(companyId), account_type: 'company_available', entity_id: companyId, entry_type: 'credit', amount_minor: abs, description: note },
      ];
}

/** Balancing invariant: Σ(debit) == Σ(credit) for one transaction. */
export function isBalanced(entries: LedgerSide[]): boolean {
  let debits = 0;
  let credits = 0;
  for (const e of entries) {
    if (!Number.isInteger(e.amount_minor) || e.amount_minor <= 0) return false;
    if (e.entry_type === 'debit') debits += e.amount_minor;
    else credits += e.amount_minor;
  }
  return debits === credits;
}

/**
 * Payout state machine — the only legal transitions. `paid` is reachable
 * ONLY from awaiting_payout/processing; failed/cancelled are terminal for
 * a payout row (retry creates a NEW payout, re-reserving the locked total).
 */
export const PAYOUT_TRANSITIONS: Record<string, string[]> = {
  awaiting_payout: ['processing', 'paid', 'failed', 'cancelled'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: [],
  failed: [],
  cancelled: [],
};

export function canTransitionPayout(from: string, to: string): boolean {
  return (PAYOUT_TRANSITIONS[from] ?? []).includes(to);
}
