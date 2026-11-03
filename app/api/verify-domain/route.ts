// Domain verification runs on the edge runtime: DNS TXT lookups use
// DNS-over-HTTPS (lib/security/dns-txt.ts), so no Node built-ins are needed.
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { verifyCompanyDomain, requestCompanyDomain, listCompanyDomains } from '@/services/verification';
import { enforceRate } from '@/lib/rate-limit';
import { logServerError, serverErrorMessage } from '@/lib/api/errors';

type Body = {
  companyId?: string;
  company_id?: string;
  domain?: string;
  domainId?: string;
  domain_id?: string;
};

/** Map service-level errors to honest HTTP statuses. */
function serviceError(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : 'unexpected';
  if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (msg.startsWith('Forbidden')) return NextResponse.json({ error: msg }, { status: 403 });
  logServerError('verify-domain', e);
  return NextResponse.json({ error: serverErrorMessage() }, { status: 500 });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Fail-closed identity check FIRST — before any service call: getUser()
  // revalidates the JWT with Supabase. If the session cannot be proven here,
  // the request is rejected; we never rely on downstream checks alone for an
  // endpoint that writes domains.
  let uid: string;
  try {
    const supabase = await createServerClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    uid = auth.user.id;
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  // Rate limit per identity: verification triggers external DNS/HTTP calls.
  try {
    enforceRate(`verify-domain:${uid}`, 12, 5 * 60_000);
  } catch {
    return NextResponse.json({ error: 'محاولات كثيرة — انتظر 5 دقائق ثم أعد المحاولة' }, { status: 429 });
  }

  const companyId = (body.companyId ?? body.company_id ?? '').trim();
  const domainRaw = (body.domain ?? '').trim().toLowerCase();
  const domainId = (body.domainId ?? body.domain_id ?? '').trim();

  try {
    // Direct verify by id
    if (domainId) {
      const res = await verifyCompanyDomain(domainId);
      if (!res.data && res.error) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      const ok = res.data?.status === 'verified';
      return NextResponse.json({
        ok,
        data: res.data,
        error: res.error,
        txt: res.data ? `masrbounty-verification=${res.data.token}` : undefined,
        host: res.data ? `_masrbounty.${res.data.domain}` : undefined,
      });
    }

    if (!companyId || !domainRaw) {
      return NextResponse.json({ error: 'companyId and domain required (or domainId)' }, { status: 400 });
    }

    const clean = domainRaw.replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
    }

    // Find existing company_domains row
    const list = await listCompanyDomains(companyId);
    if (list.error && !list.data) {
      // If RLS / not found, try to create fresh
      const created = await requestCompanyDomain(companyId, clean);
      if (created.error || !created.data) return NextResponse.json({ error: created.error ?? 'Failed to create' }, { status: 400 });
      return NextResponse.json({
        ok: false,
        data: created.data,
        txt: `masrbounty-verification=${created.data.token}`,
        host: `_masrbounty.${created.data.domain}`,
        expires_at: created.data.expires_at,
        message: 'Domain created — add TXT then POST again to verify',
      });
    }

    const existing = (list.data ?? []).find((d) => d.domain === clean);

    if (!existing) {
      const created = await requestCompanyDomain(companyId, clean);
      if (created.error || !created.data) return NextResponse.json({ error: created.error ?? 'Failed to create' }, { status: 400 });
      return NextResponse.json({
        ok: false,
        data: created.data,
        txt: `masrbounty-verification=${created.data.token}`,
        host: `_masrbounty.${created.data.domain}`,
        expires_at: created.data.expires_at,
        message: 'Domain created — add TXT then POST again to verify',
      });
    }

    // Check expiry early
    if (existing.expires_at && new Date(existing.expires_at).getTime() < Date.now()) {
      const res = await verifyCompanyDomain(existing.id);
      return NextResponse.json({
        ok: false,
        data: res.data ?? existing,
        error: res.error ?? 'Expired — recreate domain',
        txt: `masrbounty-verification=${existing.token}`,
        host: `_masrbounty.${existing.domain}`,
        expires_at: existing.expires_at,
      });
    }

    const res = await verifyCompanyDomain(existing.id);
    const ok = res.data?.status === 'verified';
    return NextResponse.json({
      ok,
      data: res.data ?? existing,
      error: res.error,
      txt: res.data ? `masrbounty-verification=${res.data.token}` : `masrbounty-verification=${existing.token}`,
      host: `_masrbounty.${existing.domain}`,
      expires_at: res.data?.expires_at ?? existing.expires_at,
    });
  } catch (e) {
    return serviceError(e);
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST {companyId, domain} or {domainId}' }, { status: 405 });
}
