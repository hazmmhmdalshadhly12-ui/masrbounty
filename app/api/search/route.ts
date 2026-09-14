export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return NextResponse.json({ ok: false, error: 'query must be at least 2 characters' }, { status: 400 });
    }
    const like = `%${q.replace(/[%_]/g, '').slice(0, 100)}%`;

    const sb = await createServerClient();
    const [{ data: programs, error: pError }, { data: researchers, error: rError }] = await Promise.all([
      sb
        .from('programs')
        .select('id,name,slug,description,logo_url,status')
        .eq('status', 'active')
        .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
        .limit(10),
      sb
        .from('researcher_profiles')
        .select('id,display_name,country,skills')
        .eq('is_public', true)
        .ilike('display_name', like)
        .limit(10),
    ]);

    if (pError) return NextResponse.json({ ok: false, error: pError.message }, { status: 500 });
    if (rError) return NextResponse.json({ ok: false, error: rError.message }, { status: 500 });
    return NextResponse.json({ ok: true, query: q, programs: programs ?? [], researchers: researchers ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
