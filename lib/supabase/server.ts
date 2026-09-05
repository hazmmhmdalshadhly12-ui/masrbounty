import { createServerClient as ssr, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cookieOptions } from '@/lib/supabase/cookies';

export async function createServerClient() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  const base = cookieOptions();
  return ssr(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, { ...base, ...options }));
        } catch {
          /* called from Server Component - ignore */
        }
      },
    },
  });
}
