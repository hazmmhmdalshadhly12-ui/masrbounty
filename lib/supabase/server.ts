import { createServerClient as ssr } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerClient() {
  const store = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  return ssr(url, anon, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: object) {
        try {
          store.set(name, value, options as never);
        } catch {
          /* called from Server Component - ignore */
        }
      },
      remove(name: string, options: object) {
        try {
          store.set(name, '', options as never);
        } catch {
          /* ignore */
        }
      },
    },
  });
}
