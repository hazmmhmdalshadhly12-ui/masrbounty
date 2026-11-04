/**
 * Pure finance helpers — no IO, fully unit-testable.
 * Used by the wallet, company payments and admin finance pages.
 */

export type Money = number | string | null | undefined;

/** Normalize any DB numeric to a finite number (DB numerics may arrive as strings). */
export function num(v: Money): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Fixed-format EGP amount for tables: 12,345.5 -> "12,345.50" */
export function money(v: Money): string {
  return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compact EGP amount for cards: 12500 -> "12,500" */
export function moneyShort(v: Money): string {
  return num(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Platform fee split — mirrors award_bounty in the DB. */
export function feeSplit(gross: Money, feePercent: number): { fee: number; net: number } {
  const g = Math.max(0, num(gross));
  const pct = Math.min(50, Math.max(0, feePercent));
  const fee = Math.round(g * pct) / 100;
  return { fee, net: Math.round((g - fee) * 100) / 100 };
}

export interface LedgerRowLike {
  amount: Money;
  created_at: string;
}

export interface RevenueRowLike {
  gross_amount: Money;
  fee_amount: Money;
  net_amount: Money;
  created_at: string;
}

export interface MonthlyBucket {
  /** "2026-11" */
  key: string;
  /** "نوفمبر 2026" */
  label: string;
  deposits: number;
  gross: number;
  fee: number;
  net: number;
  payouts: number;
}

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function monthKey(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Aggregate money movements into the last `months` calendar buckets
 * (oldest first). Rows outside the window are ignored.
 */
export function aggregateMonthly(
  deposits: LedgerRowLike[] | null,
  revenue: RevenueRowLike[] | null,
  payouts: LedgerRowLike[] | null,
  months = 6
): MonthlyBucket[] {
  const now = new Date();
  const buckets = new Map<string, MonthlyBucket>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { key, label: `${MONTHS_AR[d.getUTCMonth()]} ${d.getUTCFullYear()}`, deposits: 0, gross: 0, fee: 0, net: 0, payouts: 0 });
  }
  const add = (rows: LedgerRowLike[] | null, field: 'deposits' | 'payouts') => {
    for (const r of rows ?? []) {
      const b = buckets.get(monthKey(r.created_at));
      if (b) b[field] += Math.abs(num(r.amount));
    }
  };
  add(deposits, 'deposits');
  add(payouts, 'payouts');
  for (const r of revenue ?? []) {
    const b = buckets.get(monthKey(r.created_at));
    if (b) {
      b.gross += num(r.gross_amount);
      b.fee += num(r.fee_amount);
      b.net += num(r.net_amount);
    }
  }
  return Array.from(buckets.values());
}

/** Arabic label for a ledger txn type. */
export function txnLabel(type: string): string {
  switch (type) {
    case 'bounty': return 'مكافأة';
    case 'payout': return 'سحب';
    case 'deposit': return 'إيداع';
    case 'refund': return 'استرداد';
    case 'adjustment': return 'تسوية';
    default: return type;
  }
}

/** Arabic label for a deposit method. */
export function methodLabel(method: string): string {
  switch (method) {
    case 'vodafone_cash': return 'فودافون كاش';
    case 'instapay': return 'إنستاباي';
    case 'bank': return 'تحويل بنكي';
    case 'other': return 'أخرى';
    default: return method;
  }
}
