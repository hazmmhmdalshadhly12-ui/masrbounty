export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const ALLOWED_STATUS = new Set(['open', 'under_review', 'resolved', 'rejected']);

export async function GET(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const rawStatus = (url.searchParams.get('status') ?? '').trim();
    const status = rawStatus && ALLOWED_STATUS.has(rawStatus) ? rawStatus : null;
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 50);

    // RLS (disp_select) scopes to own / company / staff automatically.
    let query = sb
      .from('disputes')
      .select('id,report_id,reason,status,resolution,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
