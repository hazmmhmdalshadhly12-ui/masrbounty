import { sanitizeWizardDraft, draftFitsBudget, DRAFT_MAX_JSON_CHARS } from '@/components/programs/program-builder/draft-sanitize';
import { getDefaultWizardData } from '@/components/programs/program-builder/types';

describe('sanitizeWizardDraft', () => {
  it('accepts a valid default wizard payload and preserves values', () => {
    const data = getDefaultWizardData();
    data.basic.name = 'برنامج أمني تجريبي';
    data.scope.assets = [{ id: '1', type: 'api', value: 'api.example.com', description: 'واجهة برمجية' }];
    const out = sanitizeWizardDraft(JSON.parse(JSON.stringify(data)));
    expect(out).not.toBeNull();
    expect(out?.basic.name).toBe('برنامج أمني تجريبي');
    expect(out?.scope.assets[0]?.value).toBe('api.example.com');
    expect(out?.rewards.policies.length).toBe(4);
  });

  it('rejects non-object garbage', () => {
    expect(sanitizeWizardDraft(null)).toBeNull();
    expect(sanitizeWizardDraft(42)).toBeNull();
    expect(sanitizeWizardDraft('hack')).toBeNull();
  });

  it('drops unknown/invalid fields instead of trusting them', () => {
    const out = sanitizeWizardDraft({
      basic: { name: 'x', evil: '<script>' },
      verification: { domain: 'EXAMPLE.com', verified: 'yes' },
      scope: { assets: [{ type: 'nuke', value: 'v' }, 'not-an-object'] },
      rewards: { policies: [{ severity: 'apocalyptic', min_amount: -5, max_amount: 'x' }] },
      sla: { response_hours: 'NaN' },
      disclosure: { visibility: 'secret' },
    });
    expect(out).not.toBeNull();
    expect(out?.basic.name).toBe('x');
    expect(out?.verification.domain).toBe('EXAMPLE.com');
    expect(out?.verification.verified).toBe(false); // 'yes' is not boolean true
    expect(out?.scope.assets).toHaveLength(1); // string entry dropped
    expect(out?.scope.assets[0]?.type).toBe('web'); // invalid type coerced
    expect(out?.rewards.policies[0]?.severity).toBe('medium'); // coerced
    expect(out?.rewards.policies[0]?.min_amount).toBe(0); // negative clamped
    expect(out?.rewards.policies[0]?.max_amount).toBe(0); // non-number → 0
    expect(out?.sla.response_hours).toBe(48); // default restored
    expect(out?.disclosure.visibility).toBe('public'); // default restored
  });

  it('clamps counts and sizes (DoS budget)', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: String(i), type: 'web', value: `h${i}`, description: 'd' }));
    const out = sanitizeWizardDraft({ scope: { assets: many } });
    expect(out?.scope.assets.length).toBeLessThanOrEqual(50);
    const long = 'x'.repeat(100_000);
    const out2 = sanitizeWizardDraft({ basic: { name: long } });
    expect(out2?.basic.name.length).toBeLessThanOrEqual(200);
  });

  it('draftFitsBudget reflects the char budget', () => {
    expect(draftFitsBudget(getDefaultWizardData())).toBe(true);
    const huge = getDefaultWizardData();
    huge.rules.testingRules = 'x'.repeat(DRAFT_MAX_JSON_CHARS + 1);
    expect(draftFitsBudget(huge)).toBe(false);
  });
});
