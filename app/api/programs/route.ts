export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const ALLOWED_STATUS = new Set(['active', 'paused', 'closed']);

export async function GET(req: Request) {
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
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
