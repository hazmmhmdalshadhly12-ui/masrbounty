import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  // webpackIgnore prevents Vercel/Next edge bundling from tracing node: import
  const { resolveTxt } = await import(/* webpackIgnore: true */ 'node:dns/promises');
  const hosts = [`_masrbounty.${domain}`, domain];
  for (const host of hosts) {
    try {
      const records = await resolveTxt(host);
      const flat = records.map((chunks) => chunks.join(''));
      if (flat.some((txt) => txt.includes(token))) return true;
      // also check for exact masrbounty-verification=TOKEN format
      if (flat.some((txt) => txt.includes(`masrbounty-verification=${token}`))) return true;
    } catch {
      /* NXDOMAIN / no TXT — try next host */
    }
  }
  return false;
}

async function lookupTokens(domain: string, tokens: string[]): Promise<boolean> {
  for (const t of tokens) {
    if (!t) continue;
    if (await lookupToken(domain, t)) return true;
  }
  return false;
}

async function recordAttempt(domainId: string, result: 'verified' | 'failed' | 'expired' | 'pending', details: Record<string, unknown>): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('domain_verification_attempts').insert({
      domain_id: domainId,
      result,
      details,
    });
  } catch {
    /* best-effort — RLS may block non-admin, ignore */
  }
}

async function recordCompanyVerificationEvent(
  companyId: string,
  actorId: string | null,
  event: string,
  meta: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('company_verification_events').insert({
      company_id: companyId,
      actor_id: actorId,
      event,
      meta,
    });
  } catch {
    /* best-effort */
  }
}

async function notifyCompanyMembers(db: Db, companyId: string, domain: string, verified: boolean): Promise<void> {
  try {
    const { data: members } = await db.from('company_members').select('user_id').eq('company_id', companyId);
    const { data: owner } = await db.from('company_profiles').select('owner_id').eq('id', companyId).maybeSingle();
    const targets = new Set<string>();
    for (const m of (members ?? []) as { user_id: string }[]) targets.add(m.user_id);
    const oid = (owner as { owner_id: string } | null)?.owner_id;
    if (oid) targets.add(oid);
    for (const uid of targets) {
      await notify(db, uid, {
        type: 'system',
        title: verified ? `تم توثيق النطاق ${domain} ✓` : `فشل توثيق النطاق ${domain}`,
        body: verified ? 'النطاق تم توثيقه عبر DNS TXT' : 'لم يتم العثور على سجل TXT — تحقق من الإعدادات',
        link: '/company/settings',
      });
    }
  } catch {
    /* notify best-effort */
  }
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
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
    const { randomBytes: rb } = await import(/* webpackIgnore: true */ 'node:crypto');
    const token = rb(16).toString('hex');
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
    await recordCompanyVerificationEvent(companyId, actorId, 'domain_verification_requested', {
      domain: clean,
      domain_id: (data as { id: string }).id,
    });
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
    const now = new Date().toISOString();
    const patch = found
      ? { status: 'verified' as const, verified_at: now, last_checked_at: now }
      : { status: 'failed' as const, last_checked_at: now };
    const { data: updated, error: updateError } = await db
      .from('domain_verifications')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError || !updated) return { data: null, error: updateError?.message ?? 'Update failed' };
    await logAudit('verify', 'domain_verifications', id, { domain: v.domain, verified: found }, actorId);
    await recordCompanyVerificationEvent(v.company_id, actorId, found ? 'domain_verified' : 'domain_verification_failed', {
      domain: v.domain,
      domain_id: id,
      verified: found,
      host_checked: `_masrbounty.${v.domain}`,
    });
    // best-effort attempt logging for legacy — try to map to company_domains if exists
    try {
      const admin = createAdminClient();
      // only log if corresponding company_domains row exists (FK)
      const { data: cd } = await admin.from('company_domains').select('id').eq('company_id', v.company_id).eq('domain', v.domain).maybeSingle();
      if (cd) {
        await recordAttempt((cd as { id: string }).id, found ? 'verified' : 'failed', {
          domain: v.domain,
          via: 'domain_verifications',
          legacy_id: id,
          found,
        });
      }
    } catch {
      /* ignore */
    }
    if (found) {
      await notifyCompanyMembers(db, v.company_id, v.domain, true);
    } else {
      await notifyCompanyMembers(db, v.company_id, v.domain, false);
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
    const crypto = await import(/* webpackIgnore: true */ 'node:crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
    // Try new-schema columns first; fall back to legacy token column if DB not migrated
    let payload: Record<string, unknown> = {
      company_id: companyId,
      domain: clean,
      verification_token_plain: token,
      verification_token_hash: hash,
      token,
      status: 'pending',
      verified_at: null,
      expires_at: expiresAt,
    };
    let { data, error } = await db
      .from('company_domains')
      .upsert(payload, { onConflict: 'company_id,domain' })
      .select('*')
      .single();
    if (error && /column|verification_token/i.test(error.message)) {
      // Retry with legacy shape only
      payload = { company_id: companyId, domain: clean, token, status: 'pending', verified_at: null, expires_at: expiresAt };
      const retry = await db
        .from('company_domains')
        .upsert(payload, { onConflict: 'company_id,domain' })
        .select('*')
        .single();
      data = retry.data as typeof data;
      error = retry.error as typeof error;
    }
    // If expires_at column missing, ignore
    if (error && /expires_at/i.test(error.message)) {
      const noExpiry: Record<string, unknown> = {
        company_id: companyId,
        domain: clean,
        verification_token_plain: token,
        verification_token_hash: hash,
        token,
        status: 'pending',
        verified_at: null,
      };
      const retry2 = await db.from('company_domains').upsert(noExpiry, { onConflict: 'company_id,domain' }).select('*').single();
      data = retry2.data as typeof data;
      error = retry2.error as typeof error;
    }
    if (error || !data) return { data: null, error: error?.message ?? 'فشل الطلب' };
    const mapped = mapCompanyDomainRow(data as unknown as Record<string, unknown>);
    await logAudit('verify', 'company_domains', mapped.id, { companyId, domain: clean }, actorId);
    await recordCompanyVerificationEvent(companyId, actorId, 'domain_verification_requested', {
      domain: clean,
      domain_id: mapped.id,
      expires_at: mapped.expires_at,
    });
    await recordAttempt(mapped.id, 'pending', { domain: clean, action: 'request', expires_at: mapped.expires_at });
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

    // Expiry handling: if expires_at < now set expired
    if (isExpired(v.expires_at)) {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status: 'expired', last_checked_at: now, updated_at: now };
      const { data: expiredRow, error: expErr } = await db.from('company_domains').update(patch).eq('id', id).select('*').single();
      if (!expErr && expiredRow) {
        const mappedExpired = mapCompanyDomainRow(expiredRow as unknown as Record<string, unknown>);
        await recordAttempt(id, 'expired', { domain: v.domain, expires_at: v.expires_at, now });
        await recordCompanyVerificationEvent(v.company_id, actorId, 'domain_expired', { domain: v.domain, domain_id: id, expires_at: v.expires_at });
        await logAudit('verify', 'company_domains', id, { domain: v.domain, expired: true }, actorId);
        try {
          revalidatePath('/company/settings');
          revalidatePath('/company/onboarding');
        } catch {
          /* ignore */
        }
        return { data: mappedExpired, error: 'انتهت صلاحية التوثيق — أعد إنشاء الرمز' };
      }
      // fallback even if update fails
      await recordAttempt(id, 'expired', { domain: v.domain, expires_at: v.expires_at });
      return { data: v, error: 'انتهت صلاحية التوثيق — أعد إنشاء الرمز' };
    }

    const plain = v.verification_token_plain ?? v.token;
    const hash = v.verification_token_hash ?? '';
    const tokens = [plain, hash].filter((t): t is string => Boolean(t));
    const found = await lookupTokens(v.domain, tokens);

    await recordAttempt(id, found ? 'verified' : 'failed', {
      domain: v.domain,
      tokens_checked: tokens.length,
      found,
      hosts: [`_masrbounty.${v.domain}`, v.domain],
    });

    // patch must handle both schemas — include verification fields and legacy last_checked_at
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = found
      ? { status: 'verified' as const, verified_at: now, last_checked_at: now, updated_at: now }
      : { status: 'failed' as const, last_checked_at: now, updated_at: now };
    // For new schema, also ensure expires_at is pushed if verified (90d)
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
        ? { status: 'verified', verified_at: now, last_checked_at: now }
        : { status: 'failed', last_checked_at: now };
      const retry = await db.from('company_domains').update(fallbackPatch).eq('id', id).select('*').single();
      if (retry.error || !retry.data) return { data: null, error: retry.error?.message ?? updateError?.message ?? 'فشل التحديث' };
      const mappedRetry = mapCompanyDomainRow(retry.data as unknown as Record<string, unknown>);
      await logAudit('verify', 'company_domains', id, { domain: v.domain, verified: found }, actorId);
      await recordCompanyVerificationEvent(v.company_id, actorId, found ? 'domain_verified' : 'domain_verification_failed', {
        domain: v.domain,
        domain_id: id,
        verified: found,
      });
      if (found) {
        await notifyCompanyMembers(db, v.company_id, v.domain, true);
      } else {
        await notifyCompanyMembers(db, v.company_id, v.domain, false);
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
    await recordCompanyVerificationEvent(v.company_id, actorId, found ? 'domain_verified' : 'domain_verification_failed', {
      domain: v.domain,
      domain_id: id,
      verified: found,
    });
    if (found) {
      await notifyCompanyMembers(db, v.company_id, v.domain, true);
    } else {
      await notifyCompanyMembers(db, v.company_id, v.domain, false);
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
    await recordCompanyVerificationEvent((row as { company_id: string }).company_id, actorId, 'domain_deleted', { domain_id: id });
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
    // expiry handling: auto-mark expired rows (best-effort)
    const now = Date.now();
    for (const d of mapped) {
      if (d.expires_at && new Date(d.expires_at).getTime() < now && d.status !== 'expired' && d.status !== 'verified') {
        // only mark as expired if not already verified? verified also expires — spec says expired status when expires_at < now
        // Update in background
        if (d.status === 'pending' || d.status === 'failed' || d.status === 'verified') {
          try {
            await db.from('company_domains').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', d.id);
            d.status = 'expired';
          } catch {
            /* ignore */
          }
        }
      } else if (d.expires_at && new Date(d.expires_at).getTime() < now && d.status === 'verified') {
        // verified but expired -> mark expired
        try {
          await db.from('company_domains').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', d.id);
          d.status = 'expired';
        } catch {
          /* ignore */
        }
      }
    }
    // also handle verified expiry: if verified but time passed, surface as expired for UI
    const withExpiry = mapped.map((m) => {
      if (m.expires_at && isExpired(m.expires_at) && m.status === 'verified') {
        return { ...m, status: 'expired' as const };
      }
      return m;
    });
    return { data: withExpiry, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function reverifyCompanyDomain(id: string, client?: Db): Promise<ServiceResult<CompanyDomain>> {
  try {
    const db = await getDb(client);
    const { data: row, error: fetchError } = await db.from('company_domains').select('*').eq('id', id).single();
    if (fetchError || !row) return { data: null, error: fetchError?.message ?? 'النطاق غير موجود' };
    const v = mapCompanyDomainRow(row as unknown as Record<string, unknown>);
    await requireCompanyAccess(db, v.company_id);
    // reset to pending before re-check (unless already verified)
    if (v.status === 'failed' || v.status === 'expired' || v.status === 'pending') {
      const resetPatch: Record<string, unknown> = { status: 'pending', last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      // best-effort reset
      try {
        await db.from('company_domains').update(resetPatch).eq('id', id);
      } catch {
        await db.from('company_domains').update({ status: 'pending' }).eq('id', id);
      }
    }
    return verifyCompanyDomain(id, db);
  } catch (e) {
    return { data: null, error: err(e) };
  }
}
