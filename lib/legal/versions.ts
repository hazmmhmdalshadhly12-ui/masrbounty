/**
 * Legal versioning rules (pure, mirrored by the SQL RPCs).
 */

/** A user must (re-)accept when their accepted version is missing or stale. */
export function requiresAcceptance(
  acceptedVersion: number | null | undefined,
  currentVersion: number | null | undefined
): boolean {
  if (typeof currentVersion !== 'number' || currentVersion <= 0) return false;
  return typeof acceptedVersion !== 'number' || acceptedVersion < currentVersion;
}

/** Next draft version number for a document (max existing + 1). */
export function nextDraftVersion(existingVersions: number[]): number {
  return existingVersions.reduce((m, v) => Math.max(m, v), 0) + 1;
}

/** Only a DRAFT can be published; published/superseded are immutable. */
export function canPublish(status: string): boolean {
  return status === 'draft';
}
