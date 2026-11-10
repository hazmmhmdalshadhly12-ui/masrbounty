import {
  canTransition,
  allowedTransitions,
  REPORT_STATUSES,
  REPORT_TRANSITIONS,
  CLOSED_REPORT_STATUSES,
  REASON_REQUIRED_STATUSES,
  COMPANY_TRIAGE_STATUSES,
  UNREVIEWED_REPORT_STATUSES,
  FINANCE_REPORT_STATUSES,
  REPORT_STATUS_LABELS,
} from '@/constants/statuses';

/**
 * The user-specified professional lifecycle (HackerOne-inspired taxonomy,
 * own implementation). Each test maps to a rule from the master spec.
 */
describe('professional report status machine', () => {
  test('spec: New → Triaged', () => {
    expect(canTransition('submitted', 'triaged')).toBe(true);
  });

  test('spec: Triaged → Accepted and Triaged → Needs More Info', () => {
    expect(canTransition('triaged', 'accepted')).toBe(true);
    expect(canTransition('triaged', 'need_more_info')).toBe(true);
  });

  test('spec: Triaged → Duplicate', () => {
    expect(canTransition('triaged', 'duplicate')).toBe(true);
  });

  test('spec: Accepted → Resolved and Resolved → Closed', () => {
    expect(canTransition('accepted', 'resolved')).toBe(true);
    expect(canTransition('resolved', 'closed')).toBe(true);
  });

  test('spec: every lifecycle state is reachable on the happy path', () => {
    // New → Under Review → Triaged → Accepted → Reward flow → Paid → Closed
    for (const [from, to] of [
      ['submitted', 'under_review'],
      ['under_review', 'triaged'],
      ['triaged', 'accepted'],
      ['accepted', 'reward_approved'],
      ['reward_approved', 'paid'],
      ['paid', 'closed'],
    ] as const) {
      expect(canTransition(from, to)).toBe(true);
    }
    // decision states close out
    for (const s of ['rejected', 'informative', 'duplicate', 'not_applicable', 'spam'] as const) {
      expect(canTransition(s, 'closed')).toBe(true);
    }
  });

  test('nonsensical transitions are impossible', () => {
    expect(canTransition('submitted', 'resolved')).toBe(false); // must be accepted first
    expect(canTransition('submitted', 'reward_approved')).toBe(false); // finance-only path
    expect(canTransition('submitted', 'paid')).toBe(false);
    expect(canTransition('rejected', 'accepted')).toBe(false); // decisions are not reversible by company
    expect(canTransition('spam', 'accepted')).toBe(false);
    expect(canTransition('paid', 'rejected')).toBe(false);
    expect(canTransition('resolved', 'triaged')).toBe(false);
    expect(canTransition('closed', 'accepted')).toBe(false);
    expect(canTransition('accepted', 'draft')).toBe(false); // draft is never re-entered
    expect(canTransition('closed', 'under_review')).toBe(false); // staff-only reopen
    expect(canTransition('closed', 'under_review', { staff: true })).toBe(true);
  });

  test('unknown source statuses deny everything (old hole closed)', () => {
    expect(canTransition('ghost', 'accepted')).toBe(false);
    expect(canTransition('ghost', 'closed')).toBe(false);
    expect(allowedTransitions('ghost')).toEqual([]);
  });

  test('same-status updates stay legal (no-op)', () => {
    for (const s of REPORT_STATUSES) expect(canTransition(s, s)).toBe(true);
  });

  test('every status has a transition entry and Arabic label', () => {
    for (const s of REPORT_STATUSES) {
      expect(REPORT_TRANSITIONS[s]).toBeDefined();
      expect(REPORT_STATUS_LABELS[s].ar).toBeTruthy();
      expect(REPORT_STATUS_LABELS[s].en).toBeTruthy();
    }
  });

  test('semantic groups are consistent', () => {
    expect(UNREVIEWED_REPORT_STATUSES).toEqual(['submitted']); // "New" bucket
    expect(COMPANY_TRIAGE_STATUSES).toContain('spam');
    expect(COMPANY_TRIAGE_STATUSES).not.toContain('reward_approved');
    expect(COMPANY_TRIAGE_STATUSES).not.toContain('paid');
    expect(FINANCE_REPORT_STATUSES).toEqual(['reward_approved', 'paid']);
    for (const s of ['rejected', 'duplicate', 'not_applicable', 'spam'] as const) {
      expect(REASON_REQUIRED_STATUSES).toContain(s);
    }
    expect(CLOSED_REPORT_STATUSES).toContain('spam');
    expect(CLOSED_REPORT_STATUSES).not.toContain('submitted');
  });

  test('allowedTransitions drives the UI select (no fake options)', () => {
    const from = allowedTransitions('triaged');
    expect(from).toContain('accepted');
    expect(from).toContain('need_more_info');
    expect(from).not.toContain('draft');
    expect(from).not.toContain('reward_approved'); // company cannot set finance states
  });
});
