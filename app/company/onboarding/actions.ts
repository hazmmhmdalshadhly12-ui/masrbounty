'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { slugify } from '@/utils/slug';
import { requestCompanyDomain, verifyCompanyDomain, deleteCompanyDomain } from '@/services/verification';

export type ActionResult<T = unknown> = { ok: boolean; error?: string; data?: T };

export async function createOrganizationAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'سجّل الدخول أولًا' };
  const name = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const slug = slugify(rawSlug || name);
  const description = String(formData.get('description') ?? '').trim();
  const website = String(formData.get('website') ?? '').trim();
  if (!name || name.length < 2) return { ok: false, error: 'اسم الشركة مطلوب (حرفين على الأقل)' };
  if (!slug || slug.length < 3) return { ok: false, error: 'المعرّف (slug) غير صالح' };
  // prevent duplicate onboarding
  const { data: existingOwned } = await supabase.from('company_profiles').select('id').eq('owner_id', auth.user.id).limit(1).maybeSingle();
  if (existingOwned) return { ok: false, error: 'لديك مؤسسة بالفعل — انتقل للإعدادات' };
  const { data: membership } = await supabase.from('company_members').select('id').eq('user_id', auth.user.id).limit(1).maybeSingle();
  if (membership) return { ok: false, error: 'أنت عضو في مؤسسة أخرى — اطلب من المالك ترقيتك' };

  const { data: inserted, error } = await supabase
    .from('company_profiles')
    .insert({ owner_id: auth.user.id, name, slug, description: description || null, website: website || null })
    .select('id')
    .single();
  if (error || !inserted) {
    const msg = error?.message ?? 'فشل إنشاء المؤسسة';
    if (/duplicate|unique|slug/i.test(msg)) return { ok: false, error: 'المعرّف مستخدم — اختر معرفًا آخر' };
    return { ok: false, error: msg };
  }
  const cid = (inserted as { id: string }).id;
  // ensure owner member row (for RBAC that checks company_members)
  await supabase.from('company_members').insert({ company_id: cid, user_id: auth.user.id, role: 'owner' });
  revalidatePath('/company/onboarding');
  revalidatePath('/company');
  revalidatePath('/company/settings');
  return { ok: true, data: { id: cid } };
}

export async function addDomainAction(formData: FormData): Promise<ActionResult> {
  const companyId = String(formData.get('company_id') ?? '').trim();
  const rawDomain = String(formData.get('domain') ?? '').trim();
  if (!companyId) return { ok: false, error: 'معرّف الشركة مفقود' };
  const clean = rawDomain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '').trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return { ok: false, error: 'النطاق غير صالح (مثال: example.com)' };
  const res = await requestCompanyDomain(companyId, clean);
  if (res.error) return { ok: false, error: res.error };
  revalidatePath('/company/onboarding');
  revalidatePath('/company/settings');
  return { ok: true, data: res.data };
}

export async function verifyDomainAction(formData: FormData): Promise<ActionResult> {
  const domainId = String(formData.get('domain_id') ?? '').trim();
  if (!domainId) return { ok: false, error: 'معرّف النطاق مفقود' };
  const res = await verifyCompanyDomain(domainId);
  if (res.error && res.data?.status !== 'failed') {
    // if verify returned failed row, surface DNS message
    return { ok: false, error: res.error };
  }
  if (res.error && res.data) {
    revalidatePath('/company/onboarding');
    revalidatePath('/company/settings');
    return { ok: false, error: res.error };
  }
  if (res.error) return { ok: false, error: res.error };
  revalidatePath('/company/onboarding');
  revalidatePath('/company/settings');
  return { ok: true, data: res.data };
}

export async function deleteDomainAction(formData: FormData): Promise<ActionResult> {
  const domainId = String(formData.get('domain_id') ?? '').trim();
  if (!domainId) return { ok: false, error: 'معرّف النطاق مفقود' };
  const res = await deleteCompanyDomain(domainId);
  if (res.error) return { ok: false, error: res.error };
  revalidatePath('/company/onboarding');
  revalidatePath('/company/settings');
  return { ok: true };
}
