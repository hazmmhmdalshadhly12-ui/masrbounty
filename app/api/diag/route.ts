export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Temporary production diagnostic (no secrets, own session only).
 * Measures each auth step inside the real Workers runtime to locate hangs.
 */
export async function GET() {
  const t0 = Date.now();
  const steps: Record<string, unknown> = { commit: 'diag-v1' };
  try {
    const store = await cookies();
    steps.cookieNames = store.getAll().map((c) => c.name);
    steps.cookiesMs = Date.now() - t0;

    const t1 = Date.now();
    const supabase = await createServerClient();
    steps.clientMs = Date.now() - t1;

    const t2 = Date.now();
    const timed = await Promise.race([
      supabase.auth.getUser().then((r) => ({ ...r, timedOut: false })),
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true as const }), 15000)),
    ]);
    steps.getUserMs = Date.now() - t2;
    if ((timed as { timedOut?: boolean }).timedOut) {
      steps.result = 'TIMEOUT_AFTER_15S';
    } else {
      const t = timed as Awaited<ReturnType<typeof supabase.auth.getUser>>;
      steps.user = t.data.user ? { idPrefix: t.data.user.id.slice(0, 8), email: t.data.user.email } : null;
      steps.authError = t.error?.message ?? null;
      steps.result = t.data.user ? 'AUTHENTICATED' : 'ANONYMOUS';
    }
  } catch (e) {
    steps.result = 'THREW';
    steps.throwMessage = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }
  steps.totalMs = Date.now() - t0;
  return NextResponse.json(steps, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
