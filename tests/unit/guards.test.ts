import { safeNext } from '@/lib/auth/redirect';
import { isInternalLink } from '@/lib/links';
import { escapeLike } from '@/utils/search';

test('safeNext allows internal paths only', () => {
  expect(safeNext('/dashboard')).toBe('/dashboard');
  expect(safeNext('https://evil.example')).toBe('/dashboard');
  expect(safeNext('//evil.example')).toBe('/dashboard');
  expect(safeNext('/api/secret')).toBe('/dashboard');
  expect(safeNext(null)).toBe('/dashboard');
});

test('isInternalLink rejects external and protocol URLs', () => {
  expect(isInternalLink('/programs')).toBe(true);
  expect(isInternalLink('https://x.com')).toBe(false);
  expect(isInternalLink('javascript:alert(1)')).toBe(false);
  expect(isInternalLink(null)).toBe(false);
});

test('escapeLike neutralizes wildcards', () => {
  expect(escapeLike('100%_x\\y')).toBe('100\\%\\_x\\\\y');
});
