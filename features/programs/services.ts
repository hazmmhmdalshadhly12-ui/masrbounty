'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { programSchema } from '@/schemas/program';
import { slugify } from '@/utils/slug';

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
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
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

export async function toggleSaveProgram(programId: string, researcherId: string, saved: boolean) {
  const supabase = createServerClient();
  if (saved) {
    await supabase.from('saved_programs').delete().eq('program_id', programId).eq('researcher_id', researcherId);
  } else {
    await supabase.from('saved_programs').insert({ program_id: programId, researcher_id: researcherId });
  }
  revalidatePath('/programs');
}
