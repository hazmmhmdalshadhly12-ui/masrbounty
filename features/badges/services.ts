'use server'
import { createAdminClient } from '@/lib/supabase/admin';
export async function listBadges(){const db=createAdminClient();return {ok:true}}
