/**
 * Integer money core — piastres (1/100 EGP).
 *
 * The financial ledger NEVER uses floating point: every amount is an
 * integer number of piastres (BigInt-safe range). Converting user input
 * (EGP strings like "150.75") happens exactly once, here, on the server.
 */

export const PIASTRES_PER_EGP = 100;

/** Hard cap for a single reward/adjustment: 10,000,000 EGP = 1e9 piastres.
 *  Keeps `amount * rate_bp` below 2^63 in DB integer math and well inside
 *  Number.MAX_SAFE_INTEGER (9.007e15) on the server. */
export const MAX_MINOR = 1_000_000_000;
/** Deposit cap: 100,000,000 EGP = 1e10 piastres. */
export const MAX_DEPOSIT_MINOR = 10_000_000_000;

/** True for a usable minor-unit amount: a positive integer within cap. */
export function isMinor(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_MINOR;
}

/**
 * Parse an EGP amount string/number into integer piastres.
 * Accepts at most 2 decimals ("150", "150.5", "150.75"); rejects garbage,
 * negatives, zero, and >2-decimal precision instead of rounding silently.
 */
export function egpToMinor(input: string | number): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/,/g, '');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const minor = Number(whole) * PIASTRES_PER_EGP + Number((frac + '00').slice(0, 2));
  if (!Number.isInteger(minor) || minor <= 0) return null;
  return minor;
}

/** Minor -> EGP number (exact for values < 2^53/100). */
export function minorToEgp(minor: number): number {
  return minor / PIASTRES_PER_EGP;
}

/** Minor -> "1,234.56" display string (Arabic pages render as-is). */
export function formatMinor(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / PIASTRES_PER_EGP);
  const frac = String(abs % PIASTRES_PER_EGP).padStart(2, '0');
  return `${sign}${whole.toLocaleString('en-US')}.${frac}`;
}

/**
 * Success-based commission in piastres: floor(reward * rate_bp / 10000).
 * Integer-only (rate_bp = basis points, 2000 => 20%). reward must be a
 * valid minor amount; the floor always favours the paying company.
 */
export function computeCommissionMinor(rewardMinor: number, rateBp: number): number {
  if (!Number.isInteger(rewardMinor) || rewardMinor <= 0) return 0;
  if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > 10000) return 0;
  return Math.floor((rewardMinor * rateBp) / 10000);
}

export function computeTotalMinor(rewardMinor: number, rateBp: number): number {
  return rewardMinor + computeCommissionMinor(rewardMinor, rateBp);
}

/** Convert a basis-point rate to a human percent ("20", "12.5"). */
export function bpToPercent(rateBp: number): string {
  if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > 10000) return '0';
  const v = (rateBp / 100).toFixed(2).replace(/\.?0+$/, '');
  return v === '' || v === 'NaN' ? '0' : v;
}
