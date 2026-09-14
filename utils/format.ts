/** Number/date/id presentation helpers. Pure. */

export const fmtEGP = (n: number): string => {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(safe);
};

export const fmtDate = (d: string): string => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(dt);
};

export const shortId = (s: string): string => String(s ?? '').slice(0, 8);

export function truncate(s: string, max = 80): string {
  const v = String(s ?? '');
  if (v.length <= max) return v;
  return v.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}
