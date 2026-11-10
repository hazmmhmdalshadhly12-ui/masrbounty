import { reportSchema } from '@/schemas/report';
import { commentSchema } from '@/schemas/comment';
import { disputeSchema } from '@/schemas/dispute';
import { badgeColor, canTransition, allowedTransitions, severityRank } from '@/utils/report';
import { REPORT_TRANSITIONS, REPORT_STATUSES } from '@/constants/statuses';

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
  // Professional lifecycle: draft → New → Triaged → Accepted → Resolved → Closed
  const walk = ['draft', 'submitted', 'triaged', 'accepted', 'resolved', 'closed'] as const;
  for (let i = 0; i < walk.length - 1; i++) {
    expect(canTransition(walk[i] as string, walk[i + 1] as string)).toBe(true);
  }
  // Info-request round-trip: New → Needs More Info → back to review → Accepted
  expect(canTransition('submitted', 'need_more_info')).toBe(true);
  expect(canTransition('need_more_info', 'under_review')).toBe(true);
  expect(canTransition('under_review', 'accepted')).toBe(true);
});

test('report flow: closed never reopens (except staff override), unknown statuses denied', () => {
  expect(canTransition('closed', 'draft')).toBe(false);
  expect(canTransition('closed', 'closed')).toBe(true);
  expect(canTransition('closed', 'under_review')).toBe(false); // staff-only via opts.staff
  expect(canTransition('closed', 'under_review', { staff: true })).toBe(true);
  expect(allowedTransitions('submitted')).toContain('triaged');
  expect(allowedTransitions('closed')).toEqual([]); // no non-staff escape
  expect(allowedTransitions('closed', { staff: true })).toEqual(['under_review']);
  // The old machine allowed unknown statuses to transition anywhere — now denied.
  expect(canTransition('bogus_status', 'accepted')).toBe(false);
  expect(allowedTransitions('bogus_status')).toEqual([]);
  // Never re-enter draft.
  expect(canTransition('accepted', 'draft')).toBe(false);
});

test('report flow: canonical map covers every status and mirrors DB shape', () => {
  // Every status has a map entry (no undefined holes) and finance states are
  // reachable ONLY through their guarded transitions.
  for (const s of REPORT_STATUSES) {
    expect(Array.isArray(REPORT_TRANSITIONS[s])).toBe(true);
  }
  expect(REPORT_TRANSITIONS.accepted).toContain('reward_approved');
  expect(REPORT_TRANSITIONS.reward_approved).toContain('paid');
  // Company triage can never fake a financial state directly.
  expect(REPORT_TRANSITIONS.submitted).not.toContain('reward_approved');
  expect(REPORT_TRANSITIONS.submitted).not.toContain('paid');
  // Spam exists as a first-class triage decision.
  expect(REPORT_TRANSITIONS.submitted).toContain('spam');
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
