/**
 * Wizard step-order contract: domain confirmation ("تأكيد الدومين") must be
 * the LAST choice (step 8, right before publish at 9) and must NOT block
 * progress — it is optional during creation; only the publish gate
 * (checkPublishReadiness) enforces a verified + approved domain.
 */
import { STEP_LABELS_AR, TOTAL_STEPS } from '@/components/programs/program-builder/types';
import { wizardSchemas, validateStep } from '@/components/programs/program-builder/validations';
import { getDefaultWizardData } from '@/components/programs/program-builder/types';

describe('program wizard — domain confirmation as the last option', () => {
  it('places تأكيد الدومين at step 8 (of 9) right before publish', () => {
    expect(TOTAL_STEPS).toBe(9);
    expect(STEP_LABELS_AR[8]?.title).toBe('تأكيد الدومين');
    expect(STEP_LABELS_AR[9]?.title).toBe('النشر');
    expect(STEP_LABELS_AR[2]?.title).toBe('النطاق');
    expect(STEP_LABELS_AR[7]?.title).toBe('المعاينة');
  });

  it('verification schema is attached to step 8, not step 2', () => {
    expect(wizardSchemas[8 as keyof typeof wizardSchemas]).toBeDefined();
    // step 2 is now the scope step; step 7 (preview) is a free jump with no schema
    expect(wizardSchemas[2 as keyof typeof wizardSchemas]).toBeDefined();
    expect(wizardSchemas[7 as keyof typeof wizardSchemas]).toBeUndefined();
  });

  it('verification step is SKIPPABLE: empty domain passes validation', () => {
    const empty = { domain: '', filePath: '', sentence: '', verified: false, token: '' };
    const res = validateStep(8, empty);
    expect(res.ok).toBe(true);
  });

  it('verification step still rejects a malformed domain when one is entered', () => {
    const bad = { domain: 'not a domain', filePath: '', sentence: '', verified: false, token: '' };
    const res = validateStep(8, bad);
    expect(res.ok).toBe(false);
  });

  it('verification step does NOT require verified=true anymore (no blocking refine)', () => {
    const unverified = getDefaultWizardData().verification; // verified: false
    const res = validateStep(8, unverified);
    expect(res.ok).toBe(true);
  });

  it('all other steps keep their schemas (1 basic, 2 scope, 3 rules, 4 rewards, 5 sla, 6 disclosure)', () => {
    expect(wizardSchemas[1 as keyof typeof wizardSchemas]).toBeDefined();
    expect(wizardSchemas[2 as keyof typeof wizardSchemas]).toBeDefined();
    expect(wizardSchemas[3 as keyof typeof wizardSchemas]).toBeDefined();
    expect(wizardSchemas[4 as keyof typeof wizardSchemas]).toBeDefined();
    expect(wizardSchemas[5 as keyof typeof wizardSchemas]).toBeDefined();
    expect(wizardSchemas[6 as keyof typeof wizardSchemas]).toBeDefined();
  });
});
