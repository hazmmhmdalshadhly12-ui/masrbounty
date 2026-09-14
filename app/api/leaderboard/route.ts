export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const sb = await createServerClient();
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit') ?? 20) || 20, 1), 100);
    const { data, error } = await sb
      .from('researcher_leaderboard')
      .select('researcher_id,display_name,score,accepted_reports,resolved_reports,total_earned,rank')
      .order('score', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
