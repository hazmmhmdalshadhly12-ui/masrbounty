export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth.user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 5) || 5, 20);
    const [listRes, countRes] = await Promise.all([
      sb.from('notifications').select('id,type,title,body,link,is_read,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(limit),
      sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id).eq('is_read', false),
    ]);
    if (listRes.error || countRes.error) {
      // Never leak DB/RLS internals to the client; log server-side only.
      console.error('[api/notifications]', listRes.error?.message ?? countRes.error?.message);
      return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, unread: countRes.count ?? 0, items: listRes.data ?? [] });
  } catch (e) {
    console.error('[api/notifications] unexpected', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
