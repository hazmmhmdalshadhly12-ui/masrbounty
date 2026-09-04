import { createServerClient } from '@/lib/supabase/server';
export async function session(){const s=createServerClient();return s.auth.getSession()}
