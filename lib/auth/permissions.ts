/** Static RBAC matrix + pure check helpers. */

export const PERMS = {
  researcher: ['report.create', 'report.read.own', 'wallet.read.own', 'program.read'],
  company: ['program.manage', 'program.read', 'report.triage', 'report.read.company'],
  moderator: ['dispute.review', 'report.read.all', 'program.read'],
  admin: ['*'],
} as const;

export type RoleName = keyof typeof PERMS;

export function can(role: string, p: string): boolean {
  const l = (PERMS as Record<string, readonly string[]>)[role] || [];
  return l.includes('*') || (l as readonly string[]).includes(p);
}

export function hasAnyPerm(role: string, ...wanted: string[]): boolean {
  return wanted.some((p) => can(role, p));
}

export function permsFor(role: string): string[] {
  return [...(((PERMS as Record<string, readonly string[]>)[role] || []) as readonly string[])];
}
