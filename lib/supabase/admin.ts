import { createClient } from '@supabase/supabase-js';
export function createAdminClient(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL!;const k=process.env.SUPABASE_SERVICE_ROLE_KEY!;if(!u||!k) throw new Error('Missing service key');return createClient(u,k,{auth:{persistSession:false}})}
