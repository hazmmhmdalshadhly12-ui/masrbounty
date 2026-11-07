'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { REGISTRATION_AGREEMENT_SLUGS } from '@/constants/legal';
import { legalConsentSchema } from '@/features/legal/schemas';
import type { RequiredLegalDoc } from '@/types/legal';

/**
 * Legal & Security Agreement stage — server-validated acceptance.
 * The SQL RPC re-verifies: age flag true, versions match the CURRENT
 * published versions, and rows are immutable once written.
 */
export async function acceptLegalAgreementAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = legalConsentSchema.safeParse({
    terms: formData.get('terms') === 'on' || formData.get('terms') === 'true',
    age: formData.get('age') === 'on' || formData.get('age') === 'true',
    privacy: formData.get('privacy') === 'on' || formData.get('privacy') === 'true',
    authorized: formData.get('authorized') === 'on' || formData.get('authorized') === 'true',
    scope: formData.get('scope') === 'on' || formData.get('scope') === 'true',
    context: String(formData.get('context') ?? 'registration'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'يجب الموافقة على جميع البنود' };
  }

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'سجّل الدخول أولًا' };

  // Current PUBLISHED versions are resolved server-side, never from the client.
  const slugs = REGISTRATION_AGREEMENT_SLUGS as unknown as string[];
  const { data: docs } = await supabase
    .from('legal_documents')
    .select('slug,current_version,status')
    .in('slug', slugs);
  const rows = (docs ?? []) as Array<{ slug: string; current_version: number | null; status: string }>;
  const versions: number[] = [];
  for (const slug of slugs) {
    const doc = rows.find((r) => r.slug === slug);
    if (!doc || doc.status !== 'published' || !doc.current_version) {
      return { ok: false, error: 'وثيقة الالتزام غير متاحة حاليًا — حاول لاحقًا' };
    }
    versions.push(doc.current_version);
  }

  const { error } = await supabase.rpc('accept_legal_agreement', {
    p_slugs: slugs,
    p_versions: versions,
    p_age_confirmed: true,
    p_context: parsed.data.context,
  });
  if (error) {
    const m = error.message ?? '';
    if (/age confirmation/i.test(m)) return { ok: false, error: 'يجب تأكيد العمر (18 سنة أو أكثر)' };
    if (/version mismatch|not published/i.test(m)) return { ok: false, error: 'تحديثت الوثائق — أعد قراءة الموافقة' };
    return { ok: false, error: 'تعذر حفظ الموافقة — حاول لاحقًا' };
  }
  return { ok: true };
}

/** Docs this user still has to accept (gate at login / registration). */
export async function getRequiredAgreements(): Promise<RequiredLegalDoc[]> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase.rpc('get_required_legal_docs', { p_user: auth.user.id });
  return ((data ?? []) as unknown as RequiredLegalDoc[]) ?? [];
}
