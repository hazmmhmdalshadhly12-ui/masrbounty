'use server'
import { createAdminClient } from '@/lib/supabase/admin';
export async function listSearch(){const db=createAdminClient();return {ok:true}}
