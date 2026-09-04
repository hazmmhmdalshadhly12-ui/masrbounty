'use server'
import { createAdminClient } from '@/lib/supabase/admin';
export async function listReputation(){const db=createAdminClient();return {ok:true}}
