export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const status = (url.searchParams.get('status') ?? '').trim() || null;
    const programId = (url.searchParams.get('programId') ?? url.searchParams.get('program_id') ?? '').trim() || null;
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 50);

    const [{ data: rp }, { data: owned }, { data: memberships }] = await Promise.all([
      sb.from('researcher_profiles').select('id').eq('user_id', auth.user.id).maybeSingle(),
      sb.from('company_profiles').select('id').eq('owner_id', auth.user.id),
      sb.from('company_members').select('company_id').eq('user_id', auth.user.id),
    ]);

    const researcherId = (rp as { id: string } | null)?.id ?? null;
    const companyIds = [
      ...((owned as { id: string }[] | null) ?? []).map((c) => c.id),
      ...((memberships as { company_id: string }[] | null) ?? []).map((m) => m.company_id),
    ];

    let programIds: string[] = [];
    if (companyIds.length > 0) {
      const { data: progs } = await sb.from('programs').select('id').in('company_id', companyIds);
      programIds = ((progs as { id: string }[] | null) ?? []).map((p) => p.id);
    }

    if (!researcherId && programIds.length === 0) {
      // No researcher profile and no company scope — RLS would return nothing anyway.
      return NextResponse.json({ ok: true, items: [] });
    }

    const collected: Record<string, unknown>[][] = [];

    if (researcherId) {
      let q = sb
        .from('reports')
        .select(
          'id,report_number,program_id,title,status,severity,bounty_amount,created_at,submitted_at,program:programs(id,name,slug)',
        )
        .eq('researcher_id', researcherId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status) q = q.eq('status', status);
      if (programId) q = q.eq('program_id', programId);
      const res = await q;
      if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
      collected.push((res.data ?? []) as Record<string, unknown>[]);
    }

    if (programIds.length > 0) {
      const scoped = programId ? programIds.filter((p) => p === programId) : programIds;
      if (scoped.length > 0) {
        let q = sb
          .from('reports')
          .select(
            'id,report_number,program_id,title,status,severity,bounty_amount,created_at,submitted_at,program:programs(id,name,slug)',
          )
          .in('program_id', scoped)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (status) q = q.eq('status', status);
        const res = await q;
        if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
        collected.push((res.data ?? []) as Record<string, unknown>[]);
      }
    }

    const seen = new Map<string, Record<string, unknown>>();
    for (const rows of collected) {
      for (const row of rows) {
        const rowId = row['id'];
        if (typeof rowId === 'string' && !seen.has(rowId)) seen.set(rowId, row);
      }
    }
    const items = [...seen.values()]
      .sort((a, b) => String(b['created_at'] ?? '').localeCompare(String(a['created_at'] ?? '')))
      .slice(0, limit);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
