import { slugify, isValidSlug } from '@/utils/slug';

test('slugify lowercases and hyphenates latin words', () => {
  expect(slugify('Hello World')).toBe('hello-world');
});

test('slugify collapses separators and trims edge dashes', () => {
  expect(slugify('  Acme -- Web   Platform!! ')).toBe('acme-web-platform');
  expect(slugify('hello!')).toBe('hello');
});

test('slugify keeps arabic letters', () => {
  const s = slugify('منصة مكافآت الثغرات');
  expect(s).toBe('منصة-مكافآت-الثغرات');
});

test('slugify handles empty and punctuation-only input', () => {
  expect(slugify('')).toBe('');
  expect(slugify('!!!')).toBe('');
});

test('isValidSlug accepts well-formed slugs', () => {
  expect(isValidSlug('my-program')).toBe(true);
  expect(isValidSlug('ab')).toBe(false);
  expect(isValidSlug('-bad-')).toBe(false);
  expect(isValidSlug('UPPER')).toBe(false);
});
