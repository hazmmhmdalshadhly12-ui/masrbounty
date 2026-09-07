'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { enforceRate } from '@/lib/rate-limit';

function randomToken(bytes = 24): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateApiKey(formData: FormData): Promise<string> {
  const name = String(formData.get('name') ?? '').trim().slice(0, 60) || 'default';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  enforceRate(`apikey:${user.user.id}`, 5, 3_600_000);
  const token = `mb_live_${randomToken(20)}`;
  const hash = await sha256(token);
  await supabase.from('api_keys').insert({
    user_id: user.user.id,
    name,
    key_hash: hash,
    key_prefix: token.slice(0, 12),
    is_active: true,
  });
  revalidatePath('/dashboard/settings');
  // Returned once — shown to the user a single time
  return token;
}

export async function revokeApiKey(keyId: string) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId).eq('user_id', user.user.id);
  revalidatePath('/dashboard/settings');
}
