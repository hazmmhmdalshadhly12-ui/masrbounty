'use server'
import { createAdminClient } from '@/lib/supabase/admin';
export async function listHallOfFame(){const db=createAdminClient();return {ok:true}}
