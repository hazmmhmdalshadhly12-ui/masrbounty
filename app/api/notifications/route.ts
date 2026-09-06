export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function authed() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value, options }) => store.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { sb, user: data.user };
}

export async function GET(req: Request) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 5) || 5, 20);
  const [{ data: items }, { count: unread }] = await Promise.all([
    auth.sb.from('notifications').select('id,type,title,body,link,is_read,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(limit),
    auth.sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id).eq('is_read', false),
  ]);
  return NextResponse.json({ ok: true, unread: unread ?? 0, items: items ?? [] });
}
