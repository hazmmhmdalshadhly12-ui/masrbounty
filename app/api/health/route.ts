export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  let db: { ok: boolean; error?: string } = { ok: false, error: 'env missing' };
  if (hasUrl && hasAnon) {
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true });
      db = error ? { ok: false, error: error.message } : { ok: true };
    } catch (e) {
      db = { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  const healthy = hasUrl && hasAnon && db.ok;
  return Response.json(
    { healthy, env: { url: hasUrl, anon: hasAnon, service: hasService }, db, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
