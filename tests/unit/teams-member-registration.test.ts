/**
 * Member account type (العضو) — registration + platform role catalog.
 * The member is an EXPERIENCE layer, not a separate auth type: same Supabase
 * Auth account, memberships granted by invitations, upgradeable to researcher
 * later without a new account (prompt sections 1–2).
 */
import { registerSchema, registerAccountStep } from '@/schemas/auth';
import { ROLES, isRole, ROLE_LABELS } from '@/constants/roles';

const base = {
  username: 'team_member',
  email: 'member@example.com',
  password: 'Sup3rSecret!',
  confirmPassword: 'Sup3rSecret!',
  full_name: 'عضو الفريق',
  phone: '01012345678',
  role: 'member' as const,
};

describe('member registration', () => {
  test('registerSchema accepts the member role (third account choice)', () => {
    const parsed = registerSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.role).toBe('member');
  });

  test('member needs no company_name (unlike company)', () => {
    const parsed = registerSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  test('unknown roles are still rejected', () => {
    const parsed = registerSchema.safeParse({ ...base, role: 'moderator' });
    expect(parsed.success).toBe(false);
    const parsed2 = registerSchema.safeParse({ ...base, role: 'root' });
    expect(parsed2.success).toBe(false);
  });

  test('account step (step 1 of the wizard) validates the member role too', () => {
    const parsed = registerAccountStep.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  test('role catalog exposes member with arabic label and membership check', () => {
    expect(ROLES).toContain('member');
    expect(isRole('member')).toBe(true);
    expect(ROLE_LABELS.member.ar).toBe('عضو');
    expect(ROLE_LABELS.member.en).toBe('Member');
    // members are NOT staff
    expect(isRole('researcher')).toBe(true);
    expect(ROLE_LABELS.researcher.ar).toBe('باحث');
    expect(ROLE_LABELS.company.ar).toBe('شركة');
  });

  test('member password rules are identical to any account (8+ chars)', () => {
    const weak = registerSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' });
    expect(weak.success).toBe(false);
  });
});
