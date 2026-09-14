'use server';

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();

export async function noopAction(input: unknown) {
  return { ok: true as const, input };
}

export async function markNotificationReadAction(notificationId: string) {
  const parsed = idSchema.safeParse(notificationId);
  if (!parsed.success) return { ok: false as const, error: 'معرّف غير صالح' };
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false as const, error: 'سجّل الدخول أولًا' };
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', parsed.data)
    .eq('user_id', user.user.id);
  if (error) return { ok: false as const, error: 'تعذر التحديث' };
  return { ok: true as const };
}

export async function markAllNotificationsReadAction() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false as const, error: 'سجّل الدخول أولًا' };
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.user.id)
    .eq('is_read', false);
  if (error) return { ok: false as const, error: 'تعذر التحديث' };
  return { ok: true as const };
}
