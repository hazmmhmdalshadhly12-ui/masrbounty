import { createServerClient } from '@/lib/supabase/server';
export async function getUser(){const s=createServerClient();const {data}=await s.auth.getUser();return data.user}
