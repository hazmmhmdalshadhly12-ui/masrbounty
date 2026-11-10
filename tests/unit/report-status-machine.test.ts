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

  // ============================================================
  // REGRESSION SUITE — production incident 2026-11-10, ref 2310796611:
  // company opened a legacy draft report, picked the only offered option
  // (جديد / submitted), and the action threw because COMPANY_TRIAGE_STATUSES
  // was missing 'submitted' → full-page error boundary "حدث خطأً ما".
  // These tests assert the UI ↔ action contract so this class of bug
  // (offered option that the action rejects) can never ship again.
  // ============================================================

  test('REGRESSION: company can intake a legacy draft (draft → submitted)', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(allowedTransitions('draft')).toEqual(['submitted']);
    expect(COMPANY_TRIAGE_STATUSES).toContain('submitted');
  });

  test('REGRESSION: every non-finance transition the UI offers is accepted by triageReportAction', () => {
    // The company detail page renders allowedTransitions(status) filtered to
    // COMPANY_TRIAGE_STATUSES, and the action allows exactly COMPANY_TRIAGE_STATUSES.
    // Invariant: whatever remains offered must be actionable — otherwise the
    // user picks it and hits the error boundary.
    for (const s of REPORT_STATUSES) {
      const offered = allowedTransitions(s).filter(
        (t) => !(FINANCE_REPORT_STATUSES as readonly string[]).includes(t)
      );
      for (const t of offered) {
        expect({ from: s, to: t, ok: COMPANY_TRIAGE_STATUSES.includes(t) })
          .toEqual({ from: s, to: t, ok: true });
      }
    }
  });

  test('finance states stay exclusive to the money RPCs (never company-settable)', () => {
    for (const f of FINANCE_REPORT_STATUSES) {
      expect(COMPANY_TRIAGE_STATUSES).not.toContain(f);
    }
    // even though the raw map reaches finance states (accepted → reward_approved),
    // the company-facing filter removes them everywhere it is applied
    for (const s of REPORT_STATUSES) {
      const financeOffered = allowedTransitions(s).filter((t) =>
        (FINANCE_REPORT_STATUSES as readonly string[]).includes(t)
      );
      for (const f of financeOffered) {
        expect(COMPANY_TRIAGE_STATUSES).not.toContain(f);
      }
    }
  });
});
