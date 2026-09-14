export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const key = decodeURIComponent(id).trim();
    if (!key) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const sb = await createServerClient();
    // RLS (can_view_program) enforces active-or-owned visibility:
    // public-active visible to all, private only to invited researcher / owning team / staff / creator.
    const { data, error } = await sb
      .from('programs')
      .select(
        'id,company_id,name,slug,description,logo_url,visibility,status,scope,out_of_scope,safe_harbor,contact_email,response_sla_hours,created_at,updated_at,company:company_profiles(id,name,slug,logo_url,is_verified),assets:program_assets(id,type,value,description),rules:program_rules(id,title,content,sort_order),bounty_policies:bounty_policies(id,severity,min_amount,max_amount)',
      )
      .or(`id.eq.${key},slug.eq.${key}`)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
