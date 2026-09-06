import { createServerClient as ssr } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cookieOptions } from '@/lib/supabase/cookies';

/**
 * Per-request server client (@supabase/ssr 0.12).
 * Uses getAll/setAll. In pages/components setAll best-efforts into the
 * request store; authoritative persistence happens in middleware.
 */
export async function createServerClient() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  return ssr(url, anon, {
    cookieOptions: cookieOptions() as never,
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Component context - middleware persists instead */
        }
      },
    },
  });
}
