export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const conversationId = (url.searchParams.get('conversationId') ?? url.searchParams.get('conversation_id') ?? '')
      .trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 50);

    if (conversationId) {
      // Membership check first — RLS would also block, but fail fast with 403.
      const { data: member } = await sb
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (!member) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

      const { data, error } = await sb
        .from('messages')
        .select('id,conversation_id,sender_id,body,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, items: data ?? [] });
    }

    const { data: memberships, error: mError } = await sb
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', auth.user.id);
    if (mError) return NextResponse.json({ ok: false, error: mError.message }, { status: 500 });

    const ids = ((memberships as { conversation_id: string }[] | null) ?? []).map((m) => m.conversation_id);
    if (ids.length === 0) return NextResponse.json({ ok: true, items: [] });

    const { data, error } = await sb
      .from('conversations')
      .select('id,subject,report_id,created_at,updated_at')
      .in('id', ids)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
