import { createServerClient } from '@/lib/supabase/server';

export async function session() {
  const s = await createServerClient();
  return s.auth.getSession();
}
