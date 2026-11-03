export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { escapeLike } from '@/utils/search';
import { logServerError, serverErrorMessage } from '@/lib/api/errors';
import { rateLimit, limits } from '@/lib/rate-limit';

export async function GET(req: Request) {
  // Public endpoint: bound abuse per IP (per-isolate window; Redis/Upstash
  // behind the same interface for multi-instance scale).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  if (!rateLimit(`api-search:${ip}`, limits.api.max, limits.api.windowMs).ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }
  try {
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return NextResponse.json({ ok: false, error: 'query must be at least 2 characters' }, { status: 400 });
    }
    // Escape LIKE wildcards literally; slice to 100 to bound pattern length.
    const like = `%${escapeLike(q).slice(0, 100)}%`;

    const sb = await createServerClient();
    const [{ data: programs, error: pError }, { data: researchers, error: rError }] = await Promise.all([
      sb
        .from('programs')
        .select('id,name,slug,description,logo_url,status,visibility')
        .eq('status', 'active')
        .eq('visibility', 'public')
        .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
        .limit(10),
      sb
        .from('researcher_profiles')
        .select('id,display_name,country,skills')
        .eq('is_public', true)
        .ilike('display_name', like)
        .limit(10),
    ]);

    if (pError) { logServerError('search', pError.message); return NextResponse.json({ ok: false, error: serverErrorMessage() }, { status: 500 }); }
    if (rError) { logServerError('search', rError.message); return NextResponse.json({ ok: false, error: serverErrorMessage() }, { status: 500 }); }
    return NextResponse.json({ ok: true, query: q, programs: programs ?? [], researchers: researchers ?? [] });
  } catch (e) {
    logServerError('search', e);
    return NextResponse.json({ ok: false, error: serverErrorMessage() }, { status: 500 });
  }
}
