import { reportSchema } from '@/schemas/report';
import { commentSchema } from '@/schemas/comment';
import { disputeSchema } from '@/schemas/dispute';
import { badgeColor, canTransition, allowedTransitions, severityRank } from '@/utils/report';

const ID = '00000000-0000-0000-0000-000000000000';

const valid = {
  program_id: ID,
  title: 'Stored XSS in company profile bio',
  summary: 'A stored cross-site scripting vector in the public bio field.',
  vulnerability_type: 'xss',
  severity: 'high',
  affected_asset: 'https://example.com/profile',
  description: 'An attacker can persist arbitrary script in the bio that executes on every profile view by any visitor.',
  impact: 'Session hijacking of any user viewing the infected profile page.',
  reproduction_steps: '1. Save <img src=x onerror=alert(1)> in bio. 2. Visit profile. 3. Observe execution.',
};

test('report flow: valid payload parses', () => {
  expect(reportSchema.parse(valid).severity).toBe('high');
});

test('report flow: rejects short title and weak description', () => {
  expect(() => reportSchema.parse({ ...valid, title: 'short' })).toThrow();
  expect(() => reportSchema.parse({ ...valid, description: 'too short to count' })).toThrow();
});

test('report flow: severity enum is closed', () => {
  for (const s of ['informational', 'low', 'medium', 'high', 'critical']) {
    expect(reportSchema.safeParse({ ...valid, severity: s }).success).toBe(true);
  }
  expect(reportSchema.safeParse({ ...valid, severity: 'p0wned' }).success).toBe(false);
});

test('report flow: happy-path status walk is legal', () => {
  const walk = ['draft', 'submitted', 'triaging', 'accepted', 'resolved', 'closed'] as const;
  for (let i = 0; i < walk.length - 1; i++) {
    expect(canTransition(walk[i] as string, walk[i + 1] as string)).toBe(true);
  }
});

test('report flow: closed never reopens, rejections stay terminal', () => {
  expect(canTransition('closed', 'draft')).toBe(false);
  expect(canTransition('closed', 'closed')).toBe(true);
  expect(allowedTransitions('submitted')).toContain('triaging');
  expect(allowedTransitions('closed')).toEqual(['closed']);
});

test('report flow: severity badges and ranks are stable', () => {
  expect(badgeColor('critical')).toBe('bg-red-500');
  expect(badgeColor('high')).toBe('bg-orange-500');
  expect(badgeColor('nope')).toBe('bg-gray-500');
  expect(severityRank('low')).toBeLessThan(severityRank('critical'));
  expect(severityRank('bogus')).toBe(-1);
});

test('report flow: comments and disputes validate', () => {
  expect(commentSchema.parse({ report_id: ID, body: 'Looks valid, triaging now.' }).body).toContain('triaging');
  expect(() => commentSchema.parse({ report_id: ID, body: '   ' })).toThrow();
  expect(disputeSchema.parse({ report_id: ID, reason: 'The severity decision is wrong because impact is higher.' }).reason.length).toBeGreaterThan(10);
  expect(() => disputeSchema.parse({ report_id: ID, reason: 'short' })).toThrow();
});
