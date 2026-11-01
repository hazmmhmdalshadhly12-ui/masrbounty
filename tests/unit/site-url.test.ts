import { normalizeSiteUrl, DEFAULT_SITE_URL } from '@/lib/site-url';

describe('normalizeSiteUrl', () => {
  it('adds a missing scheme and lowercases the host', () => {
    expect(normalizeSiteUrl('Masrbounty.online')).toBe('https://masrbounty.online');
  });
  it('strips paths, trailing slashes and whitespace', () => {
    expect(normalizeSiteUrl('  https://masrbounty.online/ ')).toBe('https://masrbounty.online');
    expect(normalizeSiteUrl('https://masrbounty.pages.dev/foo?x=1')).toBe('https://masrbounty.pages.dev');
  });
  it('keeps http for localhost', () => {
    expect(normalizeSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });
  it('falls back on empty or invalid values', () => {
    expect(normalizeSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl('')).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl('not a url')).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl('javascript:alert(1)')).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl('ftp://masrbounty.online', 'http://x.test')).toBe('http://x.test');
  });
});
