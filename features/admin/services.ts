'use server'
import { createAdminClient } from '@/lib/supabase/admin';
export async function listAdmin(){const db=createAdminClient();return {ok:true}}
