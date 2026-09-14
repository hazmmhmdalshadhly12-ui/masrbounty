'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { hallOfFameEntrySchema } from './schemas';

export async function listHallOfFame(limit = 20) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('hall_of_fame')
    .select('id,researcher_id,company_id,program_id,achievement,display_name,recognized_at')
    .order('recognized_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addHallOfFameAction(formData: FormData) {
  const parsed = hallOfFameEntrySchema.safeParse({
    researcher_id: formData.get('researcher_id'),
    company_id: formData.get('company_id') || undefined,
    program_id: formData.get('program_id') || undefined,
    achievement: formData.get('achievement'),
    display_name: formData.get('display_name'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid entry');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.user.id);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
  if (!isStaff) {
    const { data: owned } = await supabase
      .from('company_profiles')
      .select('id')
      .eq('owner_id', user.user.id)
      .limit(1)
      .maybeSingle();
    if (!owned) throw new Error('Forbidden: staff or company owner only');
  }
  const { error } = await supabase.from('hall_of_fame').insert({
    researcher_id: parsed.data.researcher_id,
    company_id: parsed.data.company_id ?? null,
    program_id: parsed.data.program_id ?? null,
    achievement: parsed.data.achievement,
    display_name: parsed.data.display_name,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/hall-of-fame');
}

export async function removeHallOfFameAction(entryId: string) {
  if (!entryId) throw new Error('Entry id required');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.user.id);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
  if (!isStaff) throw new Error('Forbidden: staff only');
  const { error } = await supabase.from('hall_of_fame').delete().eq('id', entryId);
  if (error) throw new Error(error.message);
  revalidatePath('/hall-of-fame');
}
