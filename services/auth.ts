import { createAdminClient } from '@/lib/supabase/admin';
export async function logAuthEvent(action:string,entity:string,entityId?:string,meta:unknown={}){try{const db=createAdminClient();await db.from('audit_logs').insert({action,entity,entity_id:entityId??null,metadata:meta as object})}catch{/* noop */}}
