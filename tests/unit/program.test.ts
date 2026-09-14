import { programSchema } from '@/schemas/program';
import { companySchema } from '@/schemas/company';
import { slugify } from '@/utils/slug';

const valid = {
  name: 'Acme Web Platform',
  slug: 'acme-web-platform',
  description: 'A public bug bounty program covering the whole web platform scope.',
  visibility: 'public',
  scope: '*.acme.example, api.acme.example',
  contact_email: 'security@acme.example',
};

test('accepts a valid program payload', () => {
  expect(programSchema.parse(valid).slug).toBe('acme-web-platform');
});

test('auto slug from name passes schema', () => {
  const auto = { ...valid, slug: slugify(valid.name) };
  expect(programSchema.parse(auto).slug).toBe('acme-web-platform');
});

test('rejects short name and description', () => {
  expect(() => programSchema.parse({ ...valid, name: 'ab' })).toThrow();
  expect(() => programSchema.parse({ ...valid, description: 'too short' })).toThrow();
});

test('rejects bad slug characters and bad visibility', () => {
  expect(() => programSchema.parse({ ...valid, slug: 'BAD SLUG!' })).toThrow();
  expect(() => programSchema.parse({ ...valid, visibility: 'secret' })).toThrow();
});

test('rejects short scope and invalid contact email', () => {
  expect(() => programSchema.parse({ ...valid, scope: 'x' })).toThrow();
  expect(() => programSchema.parse({ ...valid, contact_email: 'not-an-email' })).toThrow();
});

test('company schema trims and validates website', () => {
  expect(companySchema.parse({ name: 'Acme', slug: 'acme', website: 'https://acme.example' }).name).toBe('Acme');
  expect(() => companySchema.parse({ name: 'A', slug: 'acme' })).toThrow();
  expect(() => companySchema.parse({ name: 'Acme', slug: 'bad slug!' })).toThrow();
});
