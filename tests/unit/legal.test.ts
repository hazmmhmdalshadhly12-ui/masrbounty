import { legalConsentSchema, registerAgreementStep, legalDraftSchema } from '@/features/legal/schemas';
import { requiresAcceptance, nextDraftVersion, canPublish } from '@/lib/legal/versions';
import { REGISTRATION_AGREEMENT_SLUGS, REGISTRATION_CHECKS, LEGAL_DOCUMENTS, legalDocBySlug } from '@/constants/legal';

const ALL_TRUE = { terms: true, age: true, privacy: true, authorized: true, scope: true };

describe('legal consent schemas — all five checks are mandatory', () => {
  test('registerAgreementStep passes only when every flag is true', () => {
    expect(registerAgreementStep.safeParse(ALL_TRUE).success).toBe(true);
    for (const key of Object.keys(ALL_TRUE)) {
      const broken = { ...ALL_TRUE, [key]: false };
      expect(registerAgreementStep.safeParse(broken).success).toBe(false);
    }
    expect(registerAgreementStep.safeParse({ ...ALL_TRUE, terms: false }).success).toBe(false);
  });

  test('legalConsentSchema keeps the same gate + a valid context', () => {
    expect(legalConsentSchema.safeParse({ ...ALL_TRUE, context: 'registration' }).success).toBe(true);
    expect(legalConsentSchema.safeParse({ ...ALL_TRUE, context: 'reacceptance' }).success).toBe(true);
    expect(legalConsentSchema.safeParse({ ...ALL_TRUE, context: 'bogus' }).success).toBe(false);
  });

  test('one unticked check can never complete the stage', () => {
    const onlyFour = { ...ALL_TRUE, age: false };
    const r = registerAgreementStep.safeParse(onlyFour);
    expect(r.success).toBe(false);
  });
});

describe('legal version rules (mirror of SQL RPC guards)', () => {
  test('requiresAcceptance: missing or stale acceptance gates the user', () => {
    expect(requiresAcceptance(null, 1)).toBe(true);
    expect(requiresAcceptance(undefined, 1)).toBe(true);
    expect(requiresAcceptance(1, 2)).toBe(true);
    expect(requiresAcceptance(1, 1)).toBe(false);
    expect(requiresAcceptance(3, 2)).toBe(false);
    expect(requiresAcceptance(1, null)).toBe(false); // unpublished doc never gates
  });

  test('nextDraftVersion is max+1', () => {
    expect(nextDraftVersion([])).toBe(1);
    expect(nextDraftVersion([1, 2, 5])).toBe(6);
  });

  test('only drafts can be published', () => {
    expect(canPublish('draft')).toBe(true);
    expect(canPublish('published')).toBe(false);
    expect(canPublish('superseded')).toBe(false);
  });

  test('draft content bounds enforced', () => {
    expect(legalDraftSchema.safeParse({ document_slug: 'terms-of-service', content_md: 'x'.repeat(50) }).success).toBe(true);
    expect(legalDraftSchema.safeParse({ document_slug: 'terms-of-service', content_md: 'short' }).success).toBe(false);
    expect(legalDraftSchema.safeParse({ document_slug: 'Bad Slug!', content_md: 'x'.repeat(50) }).success).toBe(false);
  });
});

describe('legal document registry', () => {
  test('exactly 12 documents registered', () => {
    expect(LEGAL_DOCUMENTS).toHaveLength(12);
    const slugs = LEGAL_DOCUMENTS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(12);
  });

  test('the three registration docs exist in the registry', () => {
    for (const slug of REGISTRATION_AGREEMENT_SLUGS) {
      expect(legalDocBySlug(slug)).toBeDefined();
    }
  });

  test('registration has exactly five mandatory checks incl. age + scope', () => {
    expect(REGISTRATION_CHECKS).toHaveLength(5);
    const ids = REGISTRATION_CHECKS.map((c) => c.id);
    expect(ids).toEqual(['terms', 'age', 'privacy', 'authorized', 'scope']);
    // Docs linked from the checks must exist in the registry
    for (const c of REGISTRATION_CHECKS) {
      if (c.linkSlug) expect(legalDocBySlug(c.linkSlug)).toBeDefined();
    }
  });
});
