import { PERMS, can, hasAnyPerm, permsFor } from '@/lib/auth/permissions';
import { isAdmin, isStaff, hasRole, normalizeRoles } from '@/utils/auth';
import { hasRequiredRole } from '@/lib/auth/require-role';

test('admin wildcard covers every permission', () => {
  expect(can('admin', 'anything.at.all')).toBe(true);
  expect(can('admin', 'report.create')).toBe(true);
});

test('researcher can create reports but not manage programs', () => {
  expect(can('researcher', 'report.create')).toBe(true);
  expect(can('researcher', 'program.manage')).toBe(false);
});

test('company can manage programs and triage, not review disputes', () => {
  expect(can('company', 'program.manage')).toBe(true);
  expect(can('company', 'report.triage')).toBe(true);
  expect(can('company', 'dispute.review')).toBe(false);
});

test('moderator can review disputes but not manage programs', () => {
  expect(can('moderator', 'dispute.review')).toBe(true);
  expect(can('moderator', 'program.manage')).toBe(false);
});

test('unknown role has no permissions', () => {
  expect(can('ghost', 'report.create')).toBe(false);
  expect(hasAnyPerm('ghost', 'report.create', 'program.manage')).toBe(false);
});

test('hasAnyPerm checks any-of semantics', () => {
  expect(hasAnyPerm('researcher', 'program.manage', 'report.create')).toBe(true);
  expect(hasAnyPerm('researcher', 'program.manage', 'dispute.review')).toBe(false);
});

test('permsFor returns a copy of the role matrix', () => {
  expect(permsFor('researcher')).toContain('report.create');
  expect(permsFor('nope')).toEqual([]);
  expect(PERMS.researcher).toContain('report.create');
});

test('utils/auth role helpers handle arrays safely', () => {
  expect(isAdmin(['researcher', 'admin'])).toBe(true);
  expect(isAdmin(['researcher'])).toBe(false);
  expect(isAdmin(null)).toBe(false);
  expect(isStaff(['moderator'])).toBe(true);
  expect(isStaff(['company'])).toBe(false);
  expect(hasRole(['company'], 'company', 'admin')).toBe(true);
  expect(hasRole([], 'admin')).toBe(false);
});

test('normalizeRoles dedupes and drops non-strings', () => {
  expect(normalizeRoles(['admin', ' admin ', '', 42, null, 'admin'])).toEqual(['admin']);
  expect(normalizeRoles('admin')).toEqual([]);
});

test('hasRequiredRole gates server helpers', () => {
  expect(hasRequiredRole(['admin'], 'admin')).toBe(true);
  expect(hasRequiredRole(['researcher'], 'admin')).toBe(false);
  expect(hasRequiredRole(['researcher'])).toBe(true);
  expect(hasRequiredRole(null, 'admin')).toBe(false);
});
