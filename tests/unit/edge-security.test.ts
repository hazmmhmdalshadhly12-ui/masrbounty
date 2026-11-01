import { randomHex, sha256Hex, isValidVerificationToken } from '@/lib/security/edge-crypto';
import { normalizeTxt, resolveTxt, hasVerificationTxt } from '@/lib/security/dns-txt';
import { webcrypto } from 'crypto';
import { TextEncoder as NodeTextEncoder } from 'util';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
  if (!globalThis.TextEncoder) {
    Object.defineProperty(globalThis, 'TextEncoder', {
      value: NodeTextEncoder,
      configurable: true,
    });
  }
});

describe('edge-crypto', () => {
  it('randomHex returns unique lowercase hex of the requested length', () => {
    const a = randomHex(16);
    const b = randomHex(16);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(a).not.toBe(b);
  });

  it('sha256Hex matches the known digest', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('validates verification token format', () => {
    expect(isValidVerificationToken(randomHex(16))).toBe(true);
    expect(isValidVerificationToken('html')).toBe(false);
    expect(isValidVerificationToken('A'.repeat(32))).toBe(false);
    expect(isValidVerificationToken(undefined)).toBe(false);
  });
});

describe('dns-txt (DNS-over-HTTPS)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('normalizes quoted and chunked TXT data', () => {
    expect(normalizeTxt('"masrbounty-verification=" "abc"')).toBe('masrbounty-verification=abc');
    expect(normalizeTxt('plain')).toBe('plain');
  });

  it('returns TXT records from the resolver', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          { type: 16, data: '"masrbounty-verification=tok"' },
          { type: 5, data: 'x' },
        ],
      }),
    }) as unknown as typeof fetch;
    await expect(resolveTxt('example.com')).resolves.toEqual(['masrbounty-verification=tok']);
  });

  it('rejects invalid hostnames without a network call', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    await expect(resolveTxt('localhost')).resolves.toEqual([]);
    await expect(resolveTxt('http://evil.com/x')).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to the second resolver and reports the matching host', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ Status: 0, Answer: [{ type: 16, data: '"tok123"' }] }),
      }) as unknown as typeof fetch;
    await expect(hasVerificationTxt('example.com', 'tok123')).resolves.toEqual({
      found: true,
      host: '_masrbounty.example.com',
    });
  });

  it('treats NXDOMAIN as no records', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ Status: 3 }),
      }) as unknown as typeof fetch;
    await expect(hasVerificationTxt('example.com', 'tok')).resolves.toEqual({ found: false });
  });
});
