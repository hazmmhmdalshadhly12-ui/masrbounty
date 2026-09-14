import { ROLES, STAFF_ROLES, isRole, isStaff, isAdmin, hasRole, canTriage } from '@/constants/roles';
import { can } from '@/lib/auth/permissions';

test('role catalog covers all four platform roles', () => {
  expect(ROLES).toEqual(['researcher', 'company', 'moderator', 'admin']);
  expect(isRole('researcher')).toBe(true);
  expect(isRole('root')).toBe(false);
});

test('staff gate only admits admin/moderator', () => {
  expect(isStaff('admin')).toBe(true);
  expect(isStaff('moderator')).toBe(true);
  expect(isStaff('company')).toBe(false);
  expect(isStaff(null)).toBe(false);
  expect(STAFF_ROLES).toContain('moderator');
});

test('admin gate is narrower than staff gate', () => {
  expect(isAdmin('admin')).toBe(true);
  expect(isAdmin('moderator')).toBe(false);
});

test('hasRole checks membership lists', () => {
  expect(hasRole(['researcher', 'company'], 'company')).toBe(true);
  expect(hasRole(['researcher'], 'admin')).toBe(false);
});

test('company triage requires owner/admin/triager', () => {
  expect(canTriage('owner')).toBe(true);
  expect(canTriage('triager')).toBe(true);
  expect(canTriage('viewer')).toBe(false);
  expect(canTriage(null)).toBe(false);
});

test('authorization matrix: researchers cannot triage, companies cannot moderate', () => {
  expect(can('researcher', 'report.triage')).toBe(false);
  expect(can('company', 'report.triage')).toBe(true);
  expect(can('company', 'dispute.review')).toBe(false);
  expect(can('moderator', 'dispute.review')).toBe(true);
  expect(can('admin', 'dispute.review')).toBe(true);
});
