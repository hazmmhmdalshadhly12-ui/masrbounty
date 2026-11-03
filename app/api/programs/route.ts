export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logServerError, serverErrorMessage } from '@/lib/api/errors';
import { rateLimit, limits } from '@/lib/rate-limit';

const ALLOWED_STATUS = new Set(['active', 'paused', 'closed']);

export async function GET(req: Request) {
  // Public endpoint: per-IP abuse bound (per-isolate; Redis behind same interface).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  if (!rateLimit(`api-programs:${ip}`, limits.api.max, limits.api.windowMs).ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }
  try {
    const sb = await createServerClient();
    const url = new URL(req.url);
    const rawStatus = (url.searchParams.get('status') ?? 'active').trim();
    const status = ALLOWED_STATUS.has(rawStatus) ? rawStatus : 'active';
    const search = (url.searchParams.get('search') ?? url.searchParams.get('q') ?? '').trim().slice(0, 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 50);

    let query = sb
      .from('programs')
      .select(
        'id,company_id,name,slug,description,logo_url,visibility,status,scope,response_sla_hours,created_at,company:company_profiles(id,name,slug,logo_url,is_verified)',
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      const like = `%${search.replace(/[%_]/g, '')}%`;
      query = query.or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) { logServerError('programs', error.message); return NextResponse.json({ ok: false, error: serverErrorMessage() }, { status: 500 }); }
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    logServerError('programs', e);
    return NextResponse.json({ ok: false, error: serverErrorMessage() }, { status: 500 });
  }
}
