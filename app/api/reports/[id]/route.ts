export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const key = decodeURIComponent(id).trim();
    if (!key) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // RLS (rep_select) enforces the access check: own researcher reports,
    // owning-company programs, or staff. Anything else yields null -> 404.
    const { data, error } = await sb
      .from('reports')
      .select(
        'id,report_number,program_id,researcher_id,title,summary,vulnerability_type,severity,affected_asset,description,impact,reproduction_steps,remediation,status,bounty_amount,cvss_score,submitted_at,resolved_at,created_at,updated_at,program:programs(id,name,slug,company_id,status)',
      )
      .or(`id.eq.${key},report_number.eq.${key}`)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const reportId = (data as { id: string }).id;
    const { data: events } = await sb
      .from('report_events')
      .select('id,from_status,to_status,note,created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ ok: true, item: data, events: events ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
