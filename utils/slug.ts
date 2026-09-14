/** URL slug generator (supports Arabic letters + latin/digits). Pure. */
export const slugify = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

/** True when the value is already a valid slug (no transform needed). */
export function isValidSlug(s: string): boolean {
  return typeof s === 'string' && s.length >= 3 && /^[a-z0-9\u0600-\u06FF]+(?:-[a-z0-9\u0600-\u06FF]+)*$/.test(s);
}
