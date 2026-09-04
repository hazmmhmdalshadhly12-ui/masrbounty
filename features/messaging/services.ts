'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { messageSchema } from '@/schemas/message';
import { enforceRate, limits } from '@/lib/rate-limit';
import { logAudit } from '@/services/audit';

export async function sendMessageAction(formData: FormData) {
  const parsed = messageSchema.safeParse({
    conversation_id: formData.get('conversation_id'),
    body: formData.get('body'),
  });
  if (!parsed.success) throw new Error('Invalid message');
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  enforceRate(`msg:${user.user.id}`, limits.message.max, limits.message.windowMs);
  const { data: member } = await supabase
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', parsed.data.conversation_id)
    .eq('user_id', user.user.id)
    .single();
  if (!member) throw new Error('Not a conversation member');
  const { error } = await supabase.from('messages').insert({
    conversation_id: parsed.data.conversation_id,
    sender_id: user.user.id,
    body: parsed.data.body,
  });
  if (error) throw new Error(error.message);
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', parsed.data.conversation_id);
  revalidatePath('/dashboard/messages');
}

export async function startConversationAction(formData: FormData) {
  const otherId = String(formData.get('user_id') ?? '');
  const subject = String(formData.get('subject') ?? '');
  if (!otherId) throw new Error('Missing user');
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: conv, error } = await supabase.from('conversations').insert({ subject, created_by: user.user.id }).select('id').single();
  if (error || !conv) throw new Error(error?.message ?? 'Failed');
  await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: user.user.id },
    { conversation_id: conv.id, user_id: otherId },
  ]);
  revalidatePath('/dashboard/messages');
}
