import { createServerClient as ssr } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cookieOptions } from '@/lib/supabase/cookies';

/**
 * NOTE: installed @supabase/ssr is 0.1.0, whose server client ONLY speaks
 * the singular cookie interface { get, set, remove }. Passing getAll/setAll
 * is silently ignored and every server session reads as empty.
 */
export async function createServerClient() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  const base = cookieOptions();
  return ssr(url, anon, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: object) {
        try {
          store.set(name, value, { ...base, ...(options as Record<string, unknown>) } as never);
        } catch {
          /* called from Server Component - ignore */
        }
      },
      remove(name: string, options: object) {
        try {
          store.set(name, '', { ...base, ...(options as Record<string, unknown>), maxAge: 0 } as never);
        } catch {
          /* ignore */
        }
      },
    },
  });
}
