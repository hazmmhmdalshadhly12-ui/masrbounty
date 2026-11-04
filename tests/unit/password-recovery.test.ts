/** @jest-environment node */

/**
 * Password-recovery flow unit tests (fix/password-recovery-flow):
 *  - failure classification for every GoTrue / PKCE failure mode
 *  - redirects never echo codes, token hashes or descriptions (no leaks)
 *  - redirects are fixed internal paths (no open redirect)
 *  - friendlyAuthError maps recovery-specific errors before generic ones
 *  - middleware renders auth pages carrying ?error= / ?ok= notices
 */
import {
  classifyRecoveryFailure,
  recoveryFailureRedirect,
  RECOVERY_MESSAGES,
} from '@/lib/auth/recovery';
import { friendlyAuthError } from '@/lib/auth/errors';
import { authPageShowsNotice } from '@/middleware';

// Realistic-looking secret values used to prove they never leak anywhere.
const SECRET_CODE = 'pkce_auth_code_9f2c-secret';
const SECRET_TOKEN_HASH = 'token_hash_DEADBEEF42-secret';
const SECRET_DESC = `leak test ${SECRET_TOKEN_HASH}`;

describe('classifyRecoveryFailure', () => {
  test('expired/used links: GoTrue hash-style errors (otp_expired)', () => {
    expect(
      classifyRecoveryFailure({
        errorCode: 'access_denied',
        errorSubCode: 'otp_expired',
        errorDescription: 'Email link is invalid or has expired',
      })
    ).toBe('expired_or_used');
  });

  test('expired/used links: error_description variants', () => {
    expect(
      classifyRecoveryFailure({ errorDescription: 'Email link is invalid or has expired' })
    ).toBe('expired_or_used');
    expect(
      classifyRecoveryFailure({ exchangeErrorMessage: 'Email link has already been used' })
    ).toBe('expired_or_used');
  });

  test('missing PKCE verifier (opened on another browser/device)', () => {
    expect(
      classifyRecoveryFailure({
        exchangeErrorMessage: 'invalid request: both auth code and code verifier should be non-empty',
      })
    ).toBe('verifier_missing');
  });

  test('anything else falls back to generic invalid', () => {
    expect(classifyRecoveryFailure({ errorCode: 'server_error' })).toBe('invalid');
    expect(classifyRecoveryFailure({})).toBe('invalid');
  });
});

describe('recoveryFailureRedirect — fixed path + no secret leakage', () => {
  const outcomes = [
    recoveryFailureRedirect({ errorSubCode: 'otp_expired' }),
    recoveryFailureRedirect({ exchangeErrorMessage: 'both auth code and code verifier should be non-empty' }),
    recoveryFailureRedirect({ errorCode: 'access_denied', errorDescription: SECRET_DESC }),
  ];

  test('always redirects to the login page with an error message', () => {
    for (const url of outcomes) {
      expect(url.startsWith('/login?error=')).toBe(true);
    }
  });

  test('messages come only from the fixed Arabic constants', () => {
    const known = Object.values(RECOVERY_MESSAGES);
    for (const url of outcomes) {
      const message = decodeURIComponent(url.split('error=')[1]);
      expect(known).toContain(message);
    }
  });

  test('never echoes the auth code or token hash', () => {
    const all = outcomes.join(' | ');
    expect(all).not.toContain(SECRET_CODE);
    expect(all).not.toContain(SECRET_TOKEN_HASH);
    expect(all).not.toContain('leak test');
  });

  test('expired and verifier-missing failures get their dedicated message', () => {
    expect(recoveryFailureRedirect({ errorSubCode: 'otp_expired' })).toContain(
      encodeURIComponent(RECOVERY_MESSAGES.expired_or_used)
    );
    expect(
      recoveryFailureRedirect({ exchangeErrorMessage: 'code verifier should be non-empty' })
    ).toContain(encodeURIComponent(RECOVERY_MESSAGES.verifier_missing));
  });
});

describe('friendlyAuthError — recovery-specific mappings', () => {
  test('missing auth session (updateUser without recovery session)', () => {
    expect(friendlyAuthError('Auth session missing!')).toContain('انتهت جلسة الاستعادة');
  });

  test('expired recovery link', () => {
    expect(friendlyAuthError('otp_expired: Email link is invalid or has expired')).toContain(
      'انتهت صلاحية رابط الاستعادة'
    );
  });

  test('missing PKCE code verifier', () => {
    expect(friendlyAuthError('both auth code and code verifier should be non-empty')).toContain(
      'نفس المتصفح'
    );
  });

  test('same-password rejection', () => {
    expect(friendlyAuthError('New password should be different from the old password.')).toContain(
      'مطابقة للحالية'
    );
  });

  test('regression: generic short-password message still wins for plain password errors', () => {
    expect(friendlyAuthError('Password should be at least 6 characters')).toBe(
      'كلمة السر قصيرة أو غير صالحة (8 أحرف على الأقل)'
    );
  });
});

describe('middleware: auth pages render user-facing notices', () => {
  test('error and ok params render the form (no dashboard bounce)', () => {
    expect(authPageShowsNotice('any', null)).toBe(true);
    expect(authPageShowsNotice(null, 'تم تغيير كلمة السر — سجّل الدخول')).toBe(true);
    expect(authPageShowsNotice('any', 'ok')).toBe(true);
  });

  test('clean auth pages still bounce authenticated users to /dashboard', () => {
    expect(authPageShowsNotice(null, null)).toBe(false);
  });
});
