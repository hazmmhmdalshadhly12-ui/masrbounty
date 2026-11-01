/**
 * Runtime-agnostic crypto helpers built on the Web Crypto API.
 * Works on Node 20+, Vercel Edge and Cloudflare Workers — no `node:crypto`.
 */

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Cryptographically secure random hex string (`bytes * 2` characters). */
export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return toHex(buf);
}

/** SHA-256 digest of a UTF-8 string, hex-encoded. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

/** Verification tokens are always 16 random bytes => 32 lowercase hex chars. */
export const VERIFICATION_TOKEN_RE = /^[a-f0-9]{32}$/;

export function isValidVerificationToken(token: unknown): token is string {
  return typeof token === 'string' && VERIFICATION_TOKEN_RE.test(token);
}
