/** Array pagination + page-math helpers. Pure functions. */

export function clampPage(page: unknown, totalPages: number): number {
  const p = Math.floor(Number(page));
  if (!Number.isFinite(p) || p < 1) return 1;
  if (totalPages < 1) return 1;
  return Math.min(p, totalPages);
}

export function totalPages(total: number, per: number): number {
  const t = Math.floor(Number(total));
  const n = Math.floor(Number(per));
  if (!Number.isFinite(t) || t <= 0) return 1;
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.ceil(t / n));
}

export function getOffset(page: number, per: number): number {
  const p = Math.floor(Number(page));
  const n = Math.floor(Number(per));
  if (!Number.isFinite(p) || p < 1 || !Number.isFinite(n) || n < 1) return 0;
  return (p - 1) * n;
}

export function paginate<T>(a: T[], page = 1, per = 20): T[] {
  if (!Array.isArray(a)) return [];
  const p = Math.floor(Number(page));
  const n = Math.floor(Number(per));
  const safePage = Number.isFinite(p) && p >= 1 ? p : 1;
  const safePer = Number.isFinite(n) && n >= 1 ? n : 20;
  return a.slice((safePage - 1) * safePer, safePage * safePer);
}

export function paginateMeta(total: number, page = 1, per = 20) {
  const pages = totalPages(total, per);
  const current = clampPage(page, pages);
  return { total, per: Math.max(1, Math.floor(Number(per)) || 20), page: current, pages, offset: getOffset(current, per) };
}
