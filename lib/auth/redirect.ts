/** Client/server-safe copy of the middleware rule: internal paths only. */
export function safeNext(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('://') || value.includes('\\')) return fallback;
  if (value.startsWith('/api/')) return fallback;
  return value;
}
