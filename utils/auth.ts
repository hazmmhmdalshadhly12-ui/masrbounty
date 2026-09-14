/** Role helpers for researcher/company/staff gates. Pure and framework-free. */

export const isAdmin = (roles: readonly string[] | null | undefined): boolean =>
  Array.isArray(roles) && roles.includes('admin');

export const isStaff = (roles: readonly string[] | null | undefined): boolean =>
  Array.isArray(roles) && (roles.includes('admin') || roles.includes('moderator'));

export function hasRole(roles: readonly string[] | null | undefined, ...wanted: string[]): boolean {
  if (!Array.isArray(roles)) return false;
  return wanted.some((r) => roles.includes(r));
}

/** Normalize unknown role input: keep strings, trim, drop empties, dedupe. */
export function normalizeRoles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const r of input) {
    if (typeof r !== 'string') continue;
    const v = r.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
