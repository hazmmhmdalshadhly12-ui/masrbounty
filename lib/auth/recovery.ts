/**
 * Password-recovery callback decision logic.
 *
 * Pure and framework-free so it can be unit-tested without mocking Next.js.
 * Security invariants enforced here:
 *  - recovery codes / token hashes are NEVER echoed into redirect URLs,
 *    messages or logs — only a broad failure kind is surfaced to the user;
 *  - the redirect target is always a fixed internal path (no open redirect);
 *  - the user is never sent to the update-password page without a verified
 *    recovery exchange (that guard lives in the callback + page).
 */

export type RecoveryFailureKind =
  | 'expired_or_used'
  | 'verifier_missing'
  | 'invalid';

export interface RecoveryFailureInput {
  /** GoTrue `error` query param (e.g. access_denied) — never logged. */
  errorCode?: string | null;
  /** GoTrue `error_code` query param (e.g. otp_expired) — never logged. */
  errorSubCode?: string | null;
  /** GoTrue `error_description` query param — never logged. */
  errorDescription?: string | null;
  /** Message from exchangeCodeForSession/verifyOtp — never logged. */
  exchangeErrorMessage?: string | null;
}

export const RECOVERY_MESSAGES: Record<RecoveryFailureKind, string> = {
  expired_or_used: 'انتهت صلاحية رابط الاستعادة أو استُخدم مسبقًا — اطلب رابطًا جديدًا',
  verifier_missing:
    'تعذر التحقق تلقائيًا — غالبًا لأن الرابط فُتح من متصفح أو جهاز مختلف عن الذي طُلبت منه الاستعادة. اطلب رابطًا جديدًا وافتحه في نفس المتصفح',
  invalid: 'رابط غير صالح أو منتهي — اطلب رابطًا جديدًا',
};

const LOGIN_PATH = '/login';

/** Classifies a recovery-token failure from GoTrue/client error signals only. */
export function classifyRecoveryFailure(input: RecoveryFailureInput): RecoveryFailureKind {
  const sub = (input.errorSubCode ?? '').toLowerCase();
  const desc = (
    (input.errorDescription ?? '') +
    ' ' +
    (input.exchangeErrorMessage ?? '')
  ).toLowerCase();
  if (sub === 'otp_expired' || desc.includes('otp_expired')) return 'expired_or_used';
  if (desc.includes('email link is invalid or has expired')) return 'expired_or_used';
  if (desc.includes('already been used') || desc.includes('already used')) return 'expired_or_used';
  if (desc.includes('code verifier')) return 'verifier_missing';
  return 'invalid';
}

/** Fixed login redirect carrying only the human message (no secrets). */
export function recoveryFailureRedirect(input: RecoveryFailureInput): string {
  const kind = classifyRecoveryFailure(input);
  return `${LOGIN_PATH}?error=` + encodeURIComponent(RECOVERY_MESSAGES[kind]);
}
