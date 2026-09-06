'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Names of all Supabase cookies (sessions, chunks, PKCE verifiers). */
export function supabaseCookieNames(): string[] {
  if (typeof document === 'undefined') return [];
  return document.cookie
    .split(';')
    .map((c) => c.trim().split('=')[0] as string)
    .filter((n) => n.startsWith('sb-'));
}

/** Hard-expire every Supabase cookie (all paths we may have used). */
export function clearSupabaseCookies(): void {
  if (typeof document === 'undefined') return;
  const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
  for (const name of supabaseCookieNames()) {
    document.cookie = `${name}=; expires=${past}; path=/`;
    document.cookie = `${name}=; expires=${past}; path=/; SameSite=Lax`;
  }
}

/**
 * Start auth from a clean slate: server sign-out (best effort) + wipe all
 * local Supabase cookies. Prevents stale sessions/chunks from shadowing or
 * mixing with a freshly created account.
 */
export async function resetBrowserSession(sb: SupabaseClient): Promise<void> {
  try {
    await sb.auth.signOut();
  } catch {
    /* ignore */
  }
  clearSupabaseCookies();
}
