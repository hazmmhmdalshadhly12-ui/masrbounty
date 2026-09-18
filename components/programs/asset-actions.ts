'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const dbTypeEnum = ['web', 'api', 'mobile', 'network', 'other'] as const;
type DbAssetType = (typeof dbTypeEnum)[number];
// UI aliases: ip -> network, cloud -> other (spec requires web/api/mobile/ip/cloud/other)
const uiToDb: Record<string, DbAssetType> = {
  web: 'web',
  api: 'api',
  mobile: 'mobile',
  ip: 'network',
  network: 'network',
  cloud: 'other',
  other: 'other',
};

const assetSchema = z.object({
  type: z.enum(['web', 'api', 'mobile', 'network', 'other', 'ip', 'cloud']),
  value: z.string().min(2).max(500), // host
  scope_status: z.enum(['in_scope', 'out_of_scope', 'unknown']).optional(),
  risk: z.enum(['low', 'medium', 'high', 'critical', 'informational', 'none']).optional(),
  description: z.string().max(1000).optional(), // desc
});

function toDbType(ui: string): DbAssetType {
  return uiToDb[ui] ?? 'other';
}

function buildDescription(input: { description?: string; scope_status?: string; risk?: string }): string | null {
  const parts: string[] = [];
  if (input.scope_status && input.scope_status !== 'unknown') parts.push(`[النطاق: ${input.scope_status}]`);
  if (input.risk && input.risk !== 'none') parts.push(`[المخاطر: ${input.risk}]`);
  const base = (input.description ?? '').trim();
  if (base) parts.push(base);
  const joined = parts.join(' ').trim();
  return joined || null;
}

async function requireCompanyAccess(programId: string) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: program } = await supabase.from('programs').select('company_id').eq('id', programId).single();
  if (!program) throw new Error('Program not found');
  const companyId = (program as { company_id: string }).company_id;
  const { data: company } = await supabase.from('company_profiles').select('owner_id').eq('id', companyId).maybeSingle();
  if (company && (company as { owner_id: string }).owner_id === user.user.id) {
    return { supabase, companyId, userId: user.user.id };
  }
  const { data: member } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.user.id)
    .maybeSingle();
  const role = (member as { role: string } | null)?.role;
  if (!role || !['owner', 'admin', 'triager'].includes(role)) {
    throw new Error('غير مصرّح لك بإدارة الأصول');
  }
  return { supabase, companyId, userId: user.user.id };
}

export async function addAssetAction(programId: string, formData: FormData) {
  const parsed = assetSchema.safeParse({
    type: String(formData.get('type') ?? 'web'),
    value: String(formData.get('value') ?? '').trim(), // host
    scope_status: String(formData.get('scope_status') ?? 'unknown').trim() || undefined,
    risk: String(formData.get('risk') ?? 'none').trim() || undefined,
    description: String(formData.get('description') ?? '').trim() || undefined, // desc
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'بيانات غير صالحة');
  const { supabase } = await requireCompanyAccess(programId);
  const dbType = toDbType(parsed.data.type);
  const desc = buildDescription(parsed.data);
  const { error } = await supabase.from('program_assets').insert({
    program_id: programId,
    type: dbType,
    value: parsed.data.value,
    description: desc,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/company/programs/${programId}`);
}

export async function updateAssetAction(assetId: string, formData: FormData) {
  const parsed = assetSchema.safeParse({
    type: String(formData.get('type') ?? 'web'),
    value: String(formData.get('value') ?? '').trim(), // host
    scope_status: String(formData.get('scope_status') ?? 'unknown').trim() || undefined,
    risk: String(formData.get('risk') ?? 'none').trim() || undefined,
    description: String(formData.get('description') ?? '').trim() || undefined, // desc
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'بيانات غير صالحة');
  const supabase = await createServerClient();
  const { data: asset } = await supabase.from('program_assets').select('program_id').eq('id', assetId).single();
  if (!asset) throw new Error('Asset not found');
  const programId = (asset as { program_id: string }).program_id;
  const { supabase: sb } = await requireCompanyAccess(programId);
  const dbType = toDbType(parsed.data.type);
  const desc = buildDescription(parsed.data);
  const { error } = await sb.from('program_assets').update({
    type: dbType,
    value: parsed.data.value,
    description: desc,
  }).eq('id', assetId);
  if (error) throw new Error(error.message);
  revalidatePath(`/company/programs/${programId}`);
}

export async function deleteAssetAction(assetId: string, programId: string) {
  const { supabase } = await requireCompanyAccess(programId);
  const { error } = await supabase.from('program_assets').delete().eq('id', assetId);
  if (error) throw new Error(error.message);
  revalidatePath(`/company/programs/${programId}`);
}
