'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function markReadAction(notificationId: string) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', user.user.id);
  revalidatePath('/dashboard/notifications');
  revalidatePath('/company/notifications');
}

export async function markAllReadAction() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.user.id).eq('is_read', false);
  revalidatePath('/dashboard/notifications');
  revalidatePath('/company/notifications');
}
