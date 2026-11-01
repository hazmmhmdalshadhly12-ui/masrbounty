/**
 * Server-side sanitizer for wizard drafts.
 * The draft round-trips browser → DB → browser as JSON, so the server must
 * validate the shape before persisting (never trust client payloads) and
 * clamp sizes so one rogue client cannot bloat the drafts table.
 */
import type { WizardData } from './types';

export const DRAFT_MAX_JSON_CHARS = 200_000;

function isStr(v: unknown, max = 20_000): v is string {
  return typeof v === 'string' && v.length <= max;
}

function pickStr(v: unknown, max = 20_000): string {
  return isStr(v, max) ? v : '';
}

const ASSET_TYPES = ['web', 'api', 'mobile', 'network', 'other'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const BOUNTY_TYPES = ['fixed', 'range'] as const;
const VISIBILITIES = ['public', 'private'] as const;
const DISCLOSURE_MODES = ['private', 'coordinated', 'public'] as const;

/**
 * Returns a normalized WizardData when `raw` is structurally valid, else null.
 * Unknown extra keys are dropped; lengths/counts are clamped defensively.
 */
export function sanitizeWizardDraft(raw: unknown): WizardData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const basicRaw = (typeof o.basic === 'object' && o.basic !== null ? o.basic : {}) as Record<string, unknown>;
  const basic = {
    name: pickStr(basicRaw.name, 200),
    slug: pickStr(basicRaw.slug, 80),
    logo_url: pickStr(basicRaw.logo_url, 2000),
    description: pickStr(basicRaw.description, 5000),
    website: pickStr(basicRaw.website, 500),
    contact_email: pickStr(basicRaw.contact_email, 320),
  };

  const verRaw = (typeof o.verification === 'object' && o.verification !== null ? o.verification : {}) as Record<string, unknown>;
  const verification = {
    domain: pickStr(verRaw.domain, 300),
    filePath: pickStr(verRaw.filePath, 500) || '/.well-known/masrbounty-verification.txt',
    sentence: pickStr(verRaw.sentence, 500),
    verified: verRaw.verified === true,
    token: pickStr(verRaw.token, 100),
  };

  const scopeRaw = (typeof o.scope === 'object' && o.scope !== null ? o.scope : {}) as Record<string, unknown>;
  const assetsIn = Array.isArray(scopeRaw.assets) ? scopeRaw.assets.slice(0, 50) : [];
  const assets = assetsIn
    .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map((a, i) => ({
      id: pickStr(a.id, 64) || String(i + 1),
      type: (ASSET_TYPES as readonly string[]).includes(a.type as string) ? (a.type as WizardData['scope']['assets'][number]['type']) : 'web',
      value: pickStr(a.value, 500),
      description: pickStr(a.description, 2000),
    }));
  const scope = { assets, out_of_scope: pickStr(scopeRaw.out_of_scope, 5000) };

  const rulesRaw = (typeof o.rules === 'object' && o.rules !== null ? o.rules : {}) as Record<string, unknown>;
  const rules = {
    testingRules: pickStr(rulesRaw.testingRules, 5000),
    safeHarbor: pickStr(rulesRaw.safeHarbor, 5000),
    prohibited: pickStr(rulesRaw.prohibited, 5000),
    rateLimits: pickStr(rulesRaw.rateLimits, 5000),
    disclosurePolicy: pickStr(rulesRaw.disclosurePolicy, 5000),
  };

  const rewRaw = (typeof o.rewards === 'object' && o.rewards !== null ? o.rewards : {}) as Record<string, unknown>;
  const policiesIn = Array.isArray(rewRaw.policies) ? rewRaw.policies.slice(0, 10) : [];
  const policies = policiesIn
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({
      severity: (SEVERITIES as readonly string[]).includes(p.severity as string) ? (p.severity as WizardData['rewards']['policies'][number]['severity']) : 'medium',
      min_amount: typeof p.min_amount === 'number' && Number.isFinite(p.min_amount) ? Math.max(0, Math.min(p.min_amount, 100_000_000)) : 0,
      max_amount: typeof p.max_amount === 'number' && Number.isFinite(p.max_amount) ? Math.max(0, Math.min(p.max_amount, 100_000_000)) : 0,
    }));
  const rewards = {
    bountyType: (BOUNTY_TYPES as readonly string[]).includes(rewRaw.bountyType as string) ? (rewRaw.bountyType as WizardData['rewards']['bountyType']) : 'range',
    policies,
  };

  const slaRaw = (typeof o.sla === 'object' && o.sla !== null ? o.sla : {}) as Record<string, unknown>;
  const num = (v: unknown, def: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100_000 ? Math.round(v) : def);
  const sla = {
    response_hours: num(slaRaw.response_hours, 48),
    triage_hours: num(slaRaw.triage_hours, 72),
    resolution_hours: num(slaRaw.resolution_hours, 168),
  };

  const disRaw = (typeof o.disclosure === 'object' && o.disclosure !== null ? o.disclosure : {}) as Record<string, unknown>;
  const disclosure = {
    visibility: (VISIBILITIES as readonly string[]).includes(disRaw.visibility as string) ? (disRaw.visibility as WizardData['disclosure']['visibility']) : 'public',
    disclosureMode: (DISCLOSURE_MODES as readonly string[]).includes(disRaw.disclosureMode as string) ? (disRaw.disclosureMode as WizardData['disclosure']['disclosureMode']) : 'coordinated',
  };

  return { basic, verification, scope, rules, rewards, sla, disclosure };
}

/** True when the JSON serialization fits the storage budget. */
export function draftFitsBudget(data: WizardData): boolean {
  try {
    return JSON.stringify(data).length <= DRAFT_MAX_JSON_CHARS;
  } catch {
    return false;
  }
}
