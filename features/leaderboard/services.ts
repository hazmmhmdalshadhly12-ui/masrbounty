'use server'
import { createAdminClient } from '@/lib/supabase/admin';
export async function listLeaderboard(){const db=createAdminClient();return {ok:true}}
