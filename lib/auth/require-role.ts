import { getUser } from './get-user';

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new Error('Unauthorized');
  return u;
}

/** Pure role check for already-loaded role lists (unit-testable; DB checks live in guard.ts). */
export function hasRequiredRole(mine: readonly string[] | null | undefined, ...wanted: string[]): boolean {
  if (!Array.isArray(mine)) return false;
  if (wanted.length === 0) return true;
  return wanted.some((r) => mine.includes(r));
}
