'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { awardBadgeSchema, badgeSchema } from './schemas';

export async function listBadges() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data, error } = await supabase
    .from('badges')
    .select('id,code,name_ar,name_en,description_ar,description_en,icon,created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listResearcherBadges(researcherId: string) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data, error } = await supabase
    .from('researcher_badges')
    .select('id,researcher_id,badge_id,awarded_at,badges(code,name_en,name_ar,icon)')
    .eq('researcher_id', researcherId)
    .order('awarded_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBadgeAction(formData: FormData) {
  const parsed = badgeSchema.safeParse({
    code: formData.get('code'),
    name_ar: formData.get('name_ar'),
    name_en: formData.get('name_en'),
    description_ar: formData.get('description_ar') || undefined,
    description_en: formData.get('description_en') || undefined,
    icon: formData.get('icon') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid badge');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin');
  if (!isAdmin) throw new Error('Forbidden: admin only');
  const { error } = await supabase.from('badges').insert({
    code: parsed.data.code,
    name_ar: parsed.data.name_ar,
    name_en: parsed.data.name_en,
    description_ar: parsed.data.description_ar ?? null,
    description_en: parsed.data.description_en ?? null,
    icon: parsed.data.icon ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/badges');
  revalidatePath('/dashboard/badges');
}

export async function awardBadgeAction(formData: FormData) {
  const parsed = awardBadgeSchema.safeParse({
    researcher_id: formData.get('researcher_id'),
    badge_id: formData.get('badge_id'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid award');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.user.id);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
  if (!isStaff) throw new Error('Forbidden: staff only');
  const { error } = await supabase.from('researcher_badges').insert({
    researcher_id: parsed.data.researcher_id,
    badge_id: parsed.data.badge_id,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/badges');
  revalidatePath('/leaderboard');
}
