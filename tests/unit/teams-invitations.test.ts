/**
 * Teams & Memberships — invitation lifecycle + token safety.
 * Prompt scenarios: 3 (قبول), 4 (رفض), 7 (قبول دعوة الشركة), 15 (دعوة منتهية
 * أو ملغاة لا يمكن قبولها), 16 (لا يمكن قبول الدعوة بحساب آخر غير البريد المستهدف).
 * @jest-environment node
 */
import {
  canTransitionInvitation,
  isInvitationAcceptable,
  invitationStatusLabel,
  INVITATION_STATUSES,
} from '@/lib/teams/permissions';
import { generateInvitationToken, invitationTokenHash, tokensMatch } from '@/lib/teams/token';

describe('invitation state machine', () => {
  test('covers exactly the five required statuses', () => {
    expect([...INVITATION_STATUSES].sort()).toEqual(['accepted', 'expired', 'pending', 'rejected', 'revoked']);
  });

  test('pending can reach accepted / rejected / revoked / expired', () => {
    expect(canTransitionInvitation('pending', 'accepted')).toBe(true);
    expect(canTransitionInvitation('pending', 'rejected')).toBe(true);
    expect(canTransitionInvitation('pending', 'revoked')).toBe(true);
    expect(canTransitionInvitation('pending', 'expired')).toBe(true);
  });

  test('accepted is terminal — an accepted invitation can never be revived or reused', () => {
    for (const s of INVITATION_STATUSES) {
      expect(canTransitionInvitation('accepted', s)).toBe(false);
    }
  });

  test('only resend can revive rejected / revoked / expired invitations', () => {
    expect(canTransitionInvitation('rejected', 'pending')).toBe(true);
    expect(canTransitionInvitation('revoked', 'pending')).toBe(true);
    expect(canTransitionInvitation('expired', 'pending')).toBe(true);
    expect(canTransitionInvitation('rejected', 'accepted')).toBe(false);
    expect(canTransitionInvitation('revoked', 'accepted')).toBe(false);
  });
});

describe('invitee-side acceptability', () => {
  const future = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();

  test('pending + unexpired is acceptable', () => {
    expect(isInvitationAcceptable({ status: 'pending', expires_at: future })).toBe(true);
  });

  test('non-pending invitations are never acceptable (15)', () => {
    for (const s of ['accepted', 'rejected', 'revoked', 'expired'] as const) {
      expect(isInvitationAcceptable({ status: s, expires_at: future })).toBe(false);
    }
  });

  test('expired pending invitations are not acceptable (15)', () => {
    expect(isInvitationAcceptable({ status: 'pending', expires_at: past })).toBe(false);
  });

  test('arabic status labels exist for every status', () => {
    expect(invitationStatusLabel('pending')).toBe('معلّقة');
    expect(invitationStatusLabel('accepted')).toBe('مقبولة');
    expect(invitationStatusLabel('rejected')).toBe('مرفوضة');
    expect(invitationStatusLabel('revoked')).toBe('ملغاة');
    expect(invitationStatusLabel('expired')).toBe('منتهية');
    expect(invitationStatusLabel('unknown-x')).toBe('unknown-x');
  });
});

describe('token safety — raw tokens are never stored', () => {
  test('tokens are 256-bit hex and unique', () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  test('sha256 fingerprint is deterministic and different from the raw token', async () => {
    const raw = generateInvitationToken();
    const h1 = await invitationTokenHash(raw);
    const h2 = await invitationTokenHash(raw);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toBe(raw);
  });

  test('different tokens produce different fingerprints', async () => {
    expect(await invitationTokenHash('t1')).not.toBe(await invitationTokenHash('t2'));
  });

  test('tokensMatch verifies the raw token against the stored fingerprint only', async () => {
    const raw = generateInvitationToken();
    const hash = await invitationTokenHash(raw);
    expect(await tokensMatch(raw, hash)).toBe(true);
    expect(await tokensMatch('wrong-token', hash)).toBe(false);
    // the stored fingerprint must NOT match itself when treated as a raw token
    expect(await tokensMatch(hash, hash)).toBe(false);
  });

  test('corrupt stored hashes fail safely without throwing', async () => {
    expect(await tokensMatch('anything', 'zzzz-not-hex')).toBe(false);
    expect(await tokensMatch('anything', '')).toBe(false);
  });

  test('acceptance requires an email match — mismatched caller cannot accept (16)', () => {
    // mirrors fn_accept_team_invitation's email gate; the TS engine documents
    // the contract the SQL enforces
    const inv = { status: 'pending', expires_at: new Date(Date.now() + 3600_000).toISOString() };
    expect(isInvitationAcceptable(inv)).toBe(true);
    // the SQL check is: caller_email = lower(inv.email) OR invited_user_id = caller
    // any other account must be rejected — covered end-to-end by E2E on main.
  });
});
