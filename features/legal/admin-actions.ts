'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction } from '@/lib/auth/admin-actions';
import { logAudit } from '@/services/audit';
import { legalDraftSchema, legalPublishSchema } from '@/features/legal/schemas';
import { legalDocBySlug } from '@/constants/legal';

/** Create a NEW draft version for a document (drafts are the only editable rows). */
export async function createLegalDraftAction(documentSlug: string) {
  const meta = legalDocBySlug(documentSlug);
  if (!meta) throw new Error('وثيقة غير معروفة');
  const { supabase, user } = await requireAdminAction();

  const { data: doc } = await supabase.from('legal_documents').select('id,current_version').eq('slug', documentSlug).single();
  if (!doc) throw new Error('الوثيقة غير موجودة');
  const docId = (doc as { id: string }).id;

  const { data: existingDraft } = await supabase
    .from('legal_document_versions')
    .select('id')
    .eq('document_id', docId)
    .eq('status', 'draft')
    .maybeSingle();
  if (existingDraft) throw new Error('يوجد مسودة قيد التحرير بالفعل — أكملها أو انشرها أولًا');

  const { data: maxRow } = await supabase
    .from('legal_document_versions')
    .select('version')
    .eq('document_id', docId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (((maxRow as { version: number } | null)?.version) ?? 0) + 1;

  const { error } = await supabase.from('legal_document_versions').insert({
    document_id: docId,
    version: nextVersion,
    content_md: `# ${meta.title}\n\n(اكتب المحتوى المحدّث هنا…)\n`,
    change_summary_ar: null,
    status: 'draft',
    created_by: user.id,
  });
  if (error) throw new Error('تعذر إنشاء المسودة');
  await logAudit('create', 'legal_document_versions', documentSlug, { version: nextVersion }, user.id);
  revalidatePath('/admin/legal');
}

/** Edit a DRAFT version. Published/superseded rows are immutable (DB trigger). */
export async function updateLegalDraftAction(versionId: string, formData: FormData) {
  const parsed = legalDraftSchema.safeParse({
    document_slug: String(formData.get('document_slug') ?? ''),
    content_md: String(formData.get('content_md') ?? ''),
    change_summary_ar: String(formData.get('change_summary_ar') ?? ''),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'بيانات المسودة غير صالحة');
  const { supabase, user } = await requireAdminAction();

  const { data: ver } = await supabase
    .from('legal_document_versions')
    .select('id,status,document_id')
    .eq('id', versionId)
    .single();
  if (!ver) throw new Error('المسودة غير موجودة');
  if ((ver as { status: string }).status !== 'draft') {
    throw new Error('الإصدارات المنشورة غير قابلة للتعديل — أنشئ إصدارًا جديدًا');
  }

  const { error } = await supabase
    .from('legal_document_versions')
    .update({
      content_md: parsed.data.content_md,
      change_summary_ar: parsed.data.change_summary_ar || null,
    })
    .eq('id', versionId)
    .eq('status', 'draft');
  if (error) throw new Error('تعذر حفظ المسودة');
  await logAudit('update', 'legal_document_versions', versionId, { slug: parsed.data.document_slug }, user.id);
  revalidatePath('/admin/legal');
  revalidatePath(`/legal/${parsed.data.document_slug}`);
}

/** Publish a draft version (draft -> published; previous version superseded). */
export async function publishLegalVersionAction(formData: FormData) {
  const parsed = legalPublishSchema.safeParse({
    document_slug: String(formData.get('document_slug') ?? ''),
    version: String(formData.get('version') ?? ''),
    requires_reacceptance: formData.get('requires_reacceptance') === 'on',
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'بيانات النشر غير صالحة');
  const { supabase, user } = await requireAdminAction();

  const { error } = await supabase.rpc('publish_legal_version', {
    p_document_slug: parsed.data.document_slug,
    p_version: parsed.data.version,
    p_requires_reacceptance: Boolean(parsed.data.requires_reacceptance),
  });
  if (error) {
    const m = error.message ?? '';
    if (/invalid state/i.test(m)) throw new Error('لا يمكن النشر — تأكد أن الإصدار مسودة');
    if (/forbidden/i.test(m)) throw new Error('غير مصرّح لك');
    throw new Error('تعذر نشر الإصدار');
  }
  await logAudit('update', 'legal_documents', parsed.data.document_slug, { published: parsed.data.version }, user.id);
  revalidatePath('/admin/legal');
  revalidatePath(`/legal/${parsed.data.document_slug}`);
  revalidatePath('/legal');
}

/** Toggle whether the document requires re-acceptance after major updates. */
export async function setRequiresReacceptanceAction(documentSlug: string, requires: boolean) {
  const { supabase, user } = await requireAdminAction();
  const { error } = await supabase
    .from('legal_documents')
    .update({ requires_reacceptance: requires })
    .eq('slug', documentSlug);
  if (error) throw new Error('تعذر تحديث الوثيقة');
  await logAudit('update', 'legal_documents', documentSlug, { requires_reacceptance: requires }, user.id);
  revalidatePath('/admin/legal');
}
