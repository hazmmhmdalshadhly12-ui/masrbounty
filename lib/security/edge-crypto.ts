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

/**
 * Constant-time string equality for secrets (webhook shared secret etc.).
 * Compares SHA-256 digests so running time does not depend on where the
 * strings first differ; fixed digest length also removes length leaks.
 */
export async function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    globalThis.crypto.subtle.digest('SHA-256', enc.encode(a)),
    globalThis.crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= (va[i] as number) ^ (vb[i] as number);
  return diff === 0;
}
