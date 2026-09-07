export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';

/**
 * Minimal liveness probe. Deliberately reveals nothing about configuration:
 * no env presence flags, no secret existence, no timestamps for correlation.
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return Response.json({ healthy: false }, { status: 503 });
    const sb = createClient(url, anon);
    const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true });
    if (error) return Response.json({ healthy: false }, { status: 503 });
    return Response.json({ healthy: true });
  } catch {
    return Response.json({ healthy: false }, { status: 503 });
  }
}
