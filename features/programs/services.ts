'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { programSchema } from '@/schemas/program';
import { slugify } from '@/utils/slug';
import { enforceRate } from '@/lib/rate-limit';

export async function createProgramAction(formData: FormData) {
  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug') || slugify(String(formData.get('name') ?? '')),
    description: formData.get('description'),
    visibility: formData.get('visibility'),
    scope: formData.get('scope'),
    contact_email: formData.get('contact_email'),
  };
  const parsed = programSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid program');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  enforceRate(`program:${user.user.id}`, 10, 3_600_000);
  const { data: company } = await supabase
    .from('company_profiles')
    .select('id')
    .eq('owner_id', user.user.id)
    .single();
  if (!company) throw new Error('Create a company profile first');
  const { data: program, error } = await supabase
    .from('programs')
    .insert({ ...parsed.data, company_id: company.id, created_by: user.user.id, status: 'draft' })
    .select('id')
    .single();
  if (error || !program) throw new Error(error?.message ?? 'Create failed');
  revalidatePath('/company/programs');
  redirect(`/company/programs/${program.id}`);
}

/** Resolve the caller's company (owner or member) or throw. */
async function requireCompany(supabase: Awaited<ReturnType<typeof createServerClient>>, userId: string) {
  const { data: owned } = await supabase
    .from('company_profiles')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  if (owned) return owned.id as string;
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error('Company access required');
  return membership.company_id as string;
}

async function requireOwnedProgram(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  programId: string,
) {
  const companyId = await requireCompany(supabase, userId);
  const { data: program, error } = await supabase
    .from('programs')
    .select('id, company_id, status')
    .eq('id', programId)
    .eq('company_id', companyId)
    .single();
  if (error || !program) throw new Error('Program not found or access denied');
  return program;
}

async function setProgramStatus(programId: string, status: 'draft' | 'active' | 'paused' | 'closed') {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await requireOwnedProgram(supabase, user.user.id, programId);
  const { error } = await supabase.from('programs').update({ status }).eq('id', programId);
  if (error) throw new Error(error.message);
  revalidatePath('/programs');
  revalidatePath('/company/programs');
  revalidatePath(`/programs/${programId}`);
}

/** Draft/paused → active: makes the program publicly visible. */
export async function publishProgramAction(programId: string) {
  await setProgramStatus(programId, 'active');
}

/** Active → paused: hides from public listing, keeps data. */
export async function pauseProgramAction(programId: string) {
  await setProgramStatus(programId, 'paused');
}

/** Paused → active. */
export async function resumeProgramAction(programId: string) {
  await setProgramStatus(programId, 'active');
}

/** Any → closed: permanent end of submissions. */
export async function closeProgramAction(programId: string) {
  await setProgramStatus(programId, 'closed');
}

/** Back to draft for rework. */
export async function unpublishProgramAction(programId: string) {
  await setProgramStatus(programId, 'draft');
}

export async function updateProgramAction(programId: string, formData: FormData) {
  const raw = {
    name: formData.get('name'),
    description: formData.get('description'),
    scope: formData.get('scope'),
    contact_email: formData.get('contact_email'),
  };
  const parsed = programSchema.pick({ name: true, description: true }).extend({
    scope: programSchema.shape.scope,
    contact_email: programSchema.shape.contact_email,
  }).safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid program');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await requireOwnedProgram(supabase, user.user.id, programId);
  const { error } = await supabase.from('programs').update(parsed.data).eq('id', programId);
  if (error) throw new Error(error.message);
  revalidatePath('/programs');
  revalidatePath('/company/programs');
  revalidatePath(`/programs/${programId}`);
}

export async function toggleSaveProgram(programId: string, saved: boolean) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  // Researcher identity always comes from the session, never arguments
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) throw new Error('Researchers only');
  if (saved) {
    await supabase.from('saved_programs').delete().eq('program_id', programId).eq('researcher_id', rp.id);
  } else {
    await supabase.from('saved_programs').insert({ program_id: programId, researcher_id: rp.id });
  }
  revalidatePath('/programs');
}
