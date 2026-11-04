/**
 * Pure onboarding helpers shared by the registration wizard, the bootstrap
 * writer and unit tests. No side effects, no Supabase imports.
 */

export const MAX_SKILLS = 20;
export const MAX_SKILL_LENGTH = 40;

/**
 * Parse a comma/newline-separated skills string into a clean array:
 * trimmed, de-duplicated (case-insensitive), empties dropped, each skill
 * length-capped, hard cap of MAX_SKILLS entries. Arabic and Latin both OK.
 */
export function parseSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[,،\n]/)) {
    const s = piece.trim().slice(0, MAX_SKILL_LENGTH);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}

/** Map wizard answers to the researcher_profiles columns (null = keep unset). */
export function researcherOnboardingColumns(answers: {
  experience_level?: string;
  skills?: string | string[];
  github?: string;
  website?: string;
}): {
  experience_level: string | null;
  skills: string[];
  github: string | null;
  website: string | null;
} {
  const skills = Array.isArray(answers.skills)
    ? parseSkills(answers.skills.join(','))
    : parseSkills(answers.skills);
  return {
    experience_level: answers.experience_level || null,
    skills,
    github: answers.github?.trim() || null,
    website: answers.website?.trim() || null,
  };
}

/** Whitelist guards mirroring the SQL CHECK constraints. */
export function isValidExperienceLevel(v: unknown): v is 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  return v === 'beginner' || v === 'intermediate' || v === 'advanced' || v === 'expert';
}

export function isValidCompanySize(v: unknown): v is '1-10' | '11-50' | '51-200' | '201-1000' | '1000+' {
  return (
    v === '1-10' || v === '11-50' || v === '51-200' || v === '201-1000' || v === '1000+'
  );
}
