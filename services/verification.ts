import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';

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
// ──────────────────────────────────────────────────────────

export interface CompanyDomain {
  id: string;
  company_id: string;
  domain: string;
  token: string;
  status: VerificationStatus;
  verified_at: string | null;
  last_checked_at: string | null;
  created_at: string;
}

/**
 * Create (or refresh) a pending company domain with a fresh secure token.
 * Mirrors requestVerification but writes to company_domains.
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
    const { data, error } = await db
      .from('company_domains')
      .upsert(
        { company_id: companyId, domain: clean, token, status: 'pending', verified_at: null },
        { onConflict: 'company_id,domain' }
      )
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'فشل الطلب' };
    await logAudit('verify', 'company_domains', (data as CompanyDomain).id, { companyId, domain: clean }, actorId);
    try {
      revalidatePath('/company/settings');
    } catch {
      /* ignore */
    }
    return { data: data as CompanyDomain, error: null };
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
    const v = row as CompanyDomain;
    const actorId = await requireCompanyAccess(db, v.company_id);
    const found = await lookupToken(v.domain, v.token);
    const patch = found
      ? { status: 'verified' as const, verified_at: new Date().toISOString(), last_checked_at: new Date().toISOString() }
      : { status: 'failed' as const, last_checked_at: new Date().toISOString() };
    const { data: updated, error: updateError } = await db
      .from('company_domains')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError || !updated) return { data: null, error: updateError?.message ?? 'فشل التحديث' };
    await logAudit('verify', 'company_domains', id, { domain: v.domain, verified: found }, actorId);
    try {
      revalidatePath('/company/settings');
    } catch {
      /* ignore */
    }
    if (!found) return { data: updated as CompanyDomain, error: 'لم يتم العثور على الرمز في سجلات DNS TXT' };
    return { data: updated as CompanyDomain, error: null };
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
    return { data: (data ?? []) as CompanyDomain[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}
