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
    const all = store.getAll();
    steps.cookieNames = all.map((c) => c.name);
    // Session cookie metadata only (length + JWT claims, never the secret).
    // Handles chunked cookies (name.0, name.1 with base64- payloads).
    const sessParts = all
      .filter((c) => c.name.includes('-auth-token') && !c.name.includes('code-verifier'))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    const raw = sessParts.map((c) => c.value.replace(/^base64-/, '')).join('');
    steps.sessChunks = sessParts.length;
    if (raw) {
      steps.sessLen = raw.length;
      const decode = (s: string): unknown => {
        try {
          return JSON.parse(s);
        } catch {
          return JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
        }
      };
      try {
        const access = decode(raw) as unknown;
        const token =
          typeof access === 'string' ? access : (access as { access_token?: string })?.access_token ?? '';
        const parts = String(token).split('.');
        steps.jwtSegments = parts.length;
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as {
            exp?: number;
            aud?: string;
            iss?: string;
          };
          steps.jwtAud = payload.aud ?? null;
          steps.jwtIssHost = (() => {
            try {
              return new URL(payload.iss ?? '').host;
            } catch {
              return null;
            }
          })();
          steps.expiresInSec = typeof payload.exp === 'number' ? payload.exp - Math.floor(Date.now() / 1000) : null;
        }
      } catch {
        steps.jwtParse = 'failed';
      }
    } else {
      steps.sessLen = 0;
    }
    try {
      steps.serverHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
    } catch {
      steps.serverHost = null;
    }
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
