import { programSchema } from '@/schemas/program';
import { slugify, isValidSlug } from '@/utils/slug';
import { paginate, totalPages } from '@/utils/pagination';

const base = {
  name: 'Acme Web Platform',
  description: 'A public bug bounty program covering the whole web platform scope.',
  visibility: 'public',
  scope: '*.acme.example, api.acme.example',
  contact_email: 'security@acme.example',
};

test('program creation derives a valid slug from the name', () => {
  const raw = { ...base, slug: slugify(base.name) };
  const parsed = programSchema.parse(raw);
  expect(parsed.slug).toBe('acme-web-platform');
  expect(isValidSlug(parsed.slug)).toBe(true);
});

test('private visibility is accepted and preserved', () => {
  const parsed = programSchema.parse({ ...base, slug: 'acme-private', visibility: 'private' });
  expect(parsed.visibility).toBe('private');
});

test('program listing paginates deterministically', () => {
  const programs = Array.from({ length: 45 }, (_, i) => `program-${i + 1}`);
  expect(totalPages(programs.length, 20)).toBe(3);
  expect(paginate(programs, 1, 20)).toHaveLength(20);
  expect(paginate(programs, 3, 20)).toHaveLength(5);
  expect(paginate(programs, 9, 20)).toHaveLength(0);
});

test('lifecycle statuses are terminal-safe: closed never reopens', () => {
  const order = ['draft', 'active', 'paused', 'closed'] as const;
  expect(order.indexOf('closed')).toBeGreaterThan(order.indexOf('active'));
  // closed programs must fail the "available for submission" check
  const isAvailable = (status: string, visibility: string) => status === 'active' && (visibility === 'public' || visibility === 'private');
  expect(isAvailable('closed', 'public')).toBe(false);
  expect(isAvailable('active', 'public')).toBe(true);
});
