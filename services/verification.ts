import { randomBytes, createHash } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify } from '@/lib/notify';

export type ServiceResult<T> = { data: T | null; error: string | null };

export type VerificationStatus = 'pending' | 'verified' | 'failed';

export interface DomainVerification {
  id: string;
  company_id: string;
  domain: string;
  token: string;
  status: VerificationStatus;
  verified_at: string | null;
  last_checked_at: string | null;
  created_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

function normalizeDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) || d.length > 253) return null;
  return d;
}

/** Caller must own the company, belong to it, or be staff. Mirrors dv policy. */
async function requireCompanyAccess(db: Db, companyId: string): Promise<string> {
  const { data: auth } = await db.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Unauthorized');
  const { data: owned } = await db
    .from('company_profiles')
    .select('id')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (owned) return userId;
  const { data: member } = await db
    .from('company_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (member) return userId;
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', userId);
  const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
  if (mine.has('admin') || mine.has('moderator')) return userId;
  throw new Error('Forbidden: not a company member');
}

async function lookupToken(domain: string, token: string): Promise<boolean> {
  const hosts = [`_masrbounty.${domain}`, domain];
  for (const host of hosts) {
    try {
      const records = await resolveTxt(host);
      const flat = records.map((chunks) => chunks.join(''));
      if (flat.some((txt) => txt.includes(token))) return true;
    } catch {
      /* NXDOMAIN / no TXT — try next host */
    }
  }
  return false;
}

/**
 * Create (or refresh) a pending domain verification with a fresh secure token.
 * The company publishes the token as a DNS TXT record, then calls verifyDomain.
 */
export async function requestVerification(
  companyId: string,
  domain: string,
  client?: Db
): Promise<ServiceResult<DomainVerification>> {
  try {
    const db = await getDb(client);
    const clean = normalizeDomain(domain);
    if (!clean) return { data: null, error: 'Invalid domain' };
    const actorId = await requireCompanyAccess(db, companyId);
    const token = randomBytes(16).toString('hex');
    const { data, error } = await db
      .from('domain_verifications')
      .upsert(
        { company_id: companyId, domain: clean, token, status: 'pending', verified_at: null },
        { onConflict: 'company_id,domain' }
      )
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Request failed' };
    await logAudit('verify', 'domain_verifications', (data as DomainVerification).id, { companyId, domain: clean }, actorId);
    try {
      revalidatePath('/company/settings');
    } catch {
      /* ignore */
    }
    return { data: data as DomainVerification, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Server-side DNS TXT check: marks verified only when the token is found in DNS. */
export async function verifyDomain(id: string, client?: Db): Promise<ServiceResult<DomainVerification>> {
  try {
    const db = await getDb(client);
    const { data: row, error: fetchError } = await db.from('domain_verifications').select('*').eq('id', id).single();
    if (fetchError || !row) return { data: null, error: fetchError?.message ?? 'Verification not found' };
    const v = row as DomainVerification;
    const actorId = await requireCompanyAccess(db, v.company_id);
    const found = await lookupToken(v.domain, v.token);
    const patch = found
      ? { status: 'verified' as const, verified_at: new Date().toISOString(), last_checked_at: new Date().toISOString() }
      : { status: 'failed' as const, last_checked_at: new Date().toISOString() };
    const { data: updated, error: updateError } = await db
      .from('domain_verifications')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError || !updated) return { data: null, error: updateError?.message ?? 'Update failed' };
    await logAudit('verify', 'domain_verifications', id, { domain: v.domain, verified: found }, actorId);
    // best-effort domain verified notification
    if (found) {
      try {
        const { data: members } = await db.from('company_members').select('user_id').eq('company_id', v.company_id);
        const { data: owner } = await db.from('company_profiles').select('owner_id').eq('id', v.company_id).maybeSingle();
        const targets = new Set<string>();
        for (const m of (members ?? []) as { user_id: string }[]) targets.add(m.user_id);
        const oid = (owner as { owner_id: string } | null)?.owner_id;
        if (oid) targets.add(oid);
        for (const uid of targets) {
          await notify(db, uid, { type: 'system', title: `تم توثيق النطاق ${v.domain} ✓`, body: 'النطاق تم توثيقه عبر DNS TXT', link: '/company/settings' });
        }
      } catch {
        /* notify best-effort */
      }
    }
    try {
      revalidatePath('/company/settings');
    } catch {
      /* ignore */
    }
    if (!found) return { data: updated as DomainVerification, error: 'Token not found in DNS TXT records' };
    return { data: updated as DomainVerification, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Reset a failed/pending row back to pending and re-run the DNS check. */
export async function reverifyVerification(id: string, client?: Db): Promise<ServiceResult<DomainVerification>> {
  try {
    const db = await getDb(client);
    const { data: row, error: fetchError } = await db.from('domain_verifications').select('*').eq('id', id).single();
    if (fetchError || !row) return { data: null, error: fetchError?.message ?? 'Verification not found' };
    const v = row as DomainVerification;
    await requireCompanyAccess(db, v.company_id);
    await db.from('domain_verifications').update({ status: 'pending' }).eq('id', id);
    return verifyDomain(id, db);
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function deleteVerification(id: string, client?: Db): Promise<ServiceResult<{ id: string }>> {
  try {
    const db = await getDb(client);
    const { data: row } = await db.from('domain_verifications').select('id,company_id').eq('id', id).single();
    if (!row) return { data: null, error: 'Verification not found' };
    const actorId = await requireCompanyAccess(db, (row as { company_id: string }).company_id);
    const { error } = await db.from('domain_verifications').delete().eq('id', id);
    if (error) return { data: null, error: error.message };
    await logAudit('delete', 'domain_verifications', id, {}, actorId);
    try {
      revalidatePath('/company/settings');
    } catch {
      /* ignore */
    }
    return { data: { id }, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listVerifications(companyId: string, client?: Db): Promise<ServiceResult<DomainVerification[]>> {
  try {
    const db = await getDb(client);
    await requireCompanyAccess(db, companyId);
    const { data, error } = await db
      .from('domain_verifications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DomainVerification[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

// ──────────────────────────────────────────────────────────
// New company_domains table (keep legacy domain_verifications working)
// Real schema (masrbounty.sql §16): domain, verification_token_hash, verification_token_plain,
// status pending|verified|failed|expired, verified_at, expires_at.
// This service maps token <-> verification_token_plain/hash for backwards compat.
// ──────────────────────────────────────────────────────────

export interface CompanyDomain {
  id: string;
  company_id: string;
  domain: string;
  token: string;
  verification_token_plain?: string | null;
  verification_token_hash?: string | null;
  status: VerificationStatus | 'expired';
  verified_at: string | null;
  last_checked_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

function mapCompanyDomainRow(row: Record<string, unknown>): CompanyDomain {
  const token =
    (row['verification_token_plain'] as string | null) ??
    (row['token'] as string | null) ??
    (row['verification_token_hash'] as string | null) ??
    '';
  return {
    id: String(row['id']),
    company_id: String(row['company_id']),
    domain: String(row['domain']),
    token,
    verification_token_plain: (row['verification_token_plain'] as string | null) ?? token,
    verification_token_hash: (row['verification_token_hash'] as string | null) ?? null,
    status: (row['status'] as CompanyDomain['status']) ?? 'pending',
    verified_at: (row['verified_at'] as string | null) ?? null,
    last_checked_at: (row['last_checked_at'] as string | null) ?? null,
    expires_at: (row['expires_at'] as string | null) ?? null,
    created_at: String(row['created_at'] ?? new Date().toISOString()),
    updated_at: (row['updated_at'] as string | null) ?? null,
  };
}

/**
 * Create (or refresh) a pending company domain with a fresh secure token.
 * Mirrors requestVerification but writes to company_domains (new schema).
 */
export async function requestCompanyDomain(
  companyId: string,
  domain: string,
  client?: Db
): Promise<ServiceResult<CompanyDomain>> {
  try {
    const db = await getDb(client);
    const clean = normalizeDomain(domain);
    if (!clean) return { data: null, error: 'النطاق غير صالح' };
    const actorId = await requireCompanyAccess(db, companyId);
    const token = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    // Try new-schema columns first; fall back to legacy token column if DB not migrated
    let payload: Record<string, unknown> = {
      company_id: companyId,
      domain: clean,
      verification_token_plain: token,
      verification_token_hash: hash,
      token,
      status: 'pending',
      verified_at: null,
    };
    let { data, error } = await db
      .from('company_domains')
      .upsert(payload, { onConflict: 'company_id,domain' })
      .select('*')
      .single();
    if (error && /column|verification_token/i.test(error.message)) {
      // Retry with legacy shape only
      payload = { company_id: companyId, domain: clean, token, status: 'pending', verified_at: null };
      const retry = await db
        .from('company_domains')
        .upsert(payload, { onConflict: 'company_id,domain' })
        .select('*')
        .single();
      data = retry.data as typeof data;
      error = retry.error as typeof error;
    }
    if (error || !data) return { data: null, error: error?.message ?? 'فشل الطلب' };
    const mapped = mapCompanyDomainRow(data as unknown as Record<string, unknown>);
    await logAudit('verify', 'company_domains', mapped.id, { companyId, domain: clean }, actorId);
    try {
      revalidatePath('/company/settings');
      revalidatePath('/company/onboarding');
    } catch {
      /* ignore */
    }
    return { data: mapped, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/**
 * Server-only DNS TXT check for company_domains.
 * Uses node:dns/promises resolveTxt — must not run on client.
 */
export async function verifyCompanyDomain(id: string, client?: Db): Promise<ServiceResult<CompanyDomain>> {
  try {
    if (typeof window !== 'undefined') {
      return { data: null, error: 'التحقق متاح على الخادم فقط' };
    }
    const db = await getDb(client);
    const { data: row, error: fetchError } = await db.from('company_domains').select('*').eq('id', id).single();
    if (fetchError || !row) return { data: null, error: fetchError?.message ?? 'النطاق غير موجود' };
    const v = mapCompanyDomainRow(row as unknown as Record<string, unknown>);
    const actorId = await requireCompanyAccess(db, v.company_id);
    const tokenToCheck = v.verification_token_plain ?? v.token;
    const found = await lookupToken(v.domain, tokenToCheck);
    // patch must handle both schemas — include verification fields and legacy last_checked_at
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = found
      ? { status: 'verified' as const, verified_at: now, last_checked_at: now, updated_at: now }
      : { status: 'failed' as const, last_checked_at: now, updated_at: now };
    // For new schema, also ensure expires_at is pushed if verified
    if (found) {
      (patch as Record<string, unknown>)['expires_at'] = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
    }
    const { data: updated, error: updateError } = await db
      .from('company_domains')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError || !updated) {
      // retry without updated_at/expires_at if columns missing
      const fallbackPatch: Record<string, unknown> = found
        ? { status: 'verified', verified_at: now }
        : { status: 'failed' };
      if (found) (fallbackPatch as Record<string, unknown>)['last_checked_at'] = now;
      else (fallbackPatch as Record<string, unknown>)['last_checked_at'] = now;
      const retry = await db.from('company_domains').update(fallbackPatch).eq('id', id).select('*').single();
      if (retry.error || !retry.data) return { data: null, error: retry.error?.message ?? updateError?.message ?? 'فشل التحديث' };
      const mappedRetry = mapCompanyDomainRow(retry.data as unknown as Record<string, unknown>);
      await logAudit('verify', 'company_domains', id, { domain: v.domain, verified: found }, actorId);
      if (found) {
        try {
          const { data: members } = await db.from('company_members').select('user_id').eq('company_id', v.company_id);
          const { data: owner } = await db.from('company_profiles').select('owner_id').eq('id', v.company_id).maybeSingle();
          const targets = new Set<string>();
          for (const m of (members ?? []) as { user_id: string }[]) targets.add(m.user_id);
          const oid = (owner as { owner_id: string } | null)?.owner_id;
          if (oid) targets.add(oid);
          for (const uid of targets) {
            await notify(db, uid, { type: 'system', title: `تم توثيق النطاق ${v.domain} ✓`, body: 'النطاق تم توثيقه عبر DNS TXT', link: '/company/settings' });
          }
        } catch {
          /* notify best-effort */
        }
      }
      try {
        revalidatePath('/company/settings');
        revalidatePath('/company/onboarding');
      } catch {
        /* ignore */
      }
      if (!found) return { data: mappedRetry, error: 'لم يتم العثور على الرمز في سجلات DNS TXT' };
      return { data: mappedRetry, error: null };
    }
    const mapped = mapCompanyDomainRow(updated as unknown as Record<string, unknown>);
    await logAudit('verify', 'company_domains', id, { domain: v.domain, verified: found }, actorId);
    if (found) {
      try {
        const { data: members } = await db.from('company_members').select('user_id').eq('company_id', v.company_id);
        const { data: owner } = await db.from('company_profiles').select('owner_id').eq('id', v.company_id).maybeSingle();
        const targets = new Set<string>();
        for (const m of (members ?? []) as { user_id: string }[]) targets.add(m.user_id);
        const oid = (owner as { owner_id: string } | null)?.owner_id;
        if (oid) targets.add(oid);
        for (const uid of targets) {
          await notify(db, uid, { type: 'system', title: `تم توثيق النطاق ${v.domain} ✓`, body: 'النطاق تم توثيقه عبر DNS TXT', link: '/company/settings' });
        }
      } catch {
        /* notify best-effort */
      }
    }
    try {
      revalidatePath('/company/settings');
      revalidatePath('/company/onboarding');
    } catch {
      /* ignore */
    }
    if (!found) return { data: mapped, error: 'لم يتم العثور على الرمز في سجلات DNS TXT' };
    return { data: mapped, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function deleteCompanyDomain(id: string, client?: Db): Promise<ServiceResult<{ id: string }>> {
  try {
    const db = await getDb(client);
    const { data: row } = await db.from('company_domains').select('id,company_id').eq('id', id).single();
    if (!row) return { data: null, error: 'النطاق غير موجود' };
    const actorId = await requireCompanyAccess(db, (row as { company_id: string }).company_id);
    const { error } = await db.from('company_domains').delete().eq('id', id);
    if (error) return { data: null, error: error.message };
    await logAudit('delete', 'company_domains', id, {}, actorId);
    try {
      revalidatePath('/company/settings');
      revalidatePath('/company/onboarding');
    } catch {
      /* ignore */
    }
    return { data: { id }, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listCompanyDomains(
  companyId: string,
  client?: Db
): Promise<ServiceResult<CompanyDomain[]>> {
  try {
    const db = await getDb(client);
    await requireCompanyAccess(db, companyId);
    const { data, error } = await db
      .from('company_domains')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    const mapped = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapCompanyDomainRow);
    return { data: mapped, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}
