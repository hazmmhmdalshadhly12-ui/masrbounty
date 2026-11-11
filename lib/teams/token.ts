/**
 * Invitation token utilities — raw tokens are returned to the caller exactly
 * once (for the shareable link / email) and only their sha256 fingerprint is
 * stored in the database.
 *
 * Edge-runtime safe (Cloudflare Pages/workerd): uses the Web Crypto API that
 * exists in every runtime we deploy to (workerd, Node 18+, jsdom in tests).
 * Never import node:crypto here — the build fails on the edge runtime.
 */

/** 256-bit hex invitation token (Web Crypto, sync — available everywhere). */
export function generateInvitationToken(): string {
  const bytes = new Uint8Array(32);
  cryptoRef().getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function cryptoRef(): Crypto {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!c?.subtle || !c.getRandomValues) {
    throw new Error('Web Crypto API unavailable in this runtime');
  }
  return c;
}

/** sha256 hex fingerprint of a raw token (async — subtle.digest). */
export async function invitationTokenHash(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const digest = await cryptoRef().subtle.digest('SHA-256', data);
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** Constant-shape comparison of a raw token against a stored fingerprint. */
export async function tokensMatch(rawToken: string, storedHash: string): Promise<boolean> {
  try {
    const actual = await invitationTokenHash(rawToken);
    if (!/^[0-9a-f]{64}$/.test(storedHash) || storedHash.length !== actual.length) return false;
    // folded XOR compare — no early exit on mismatch
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ storedHash.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
