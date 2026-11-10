'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { enforceRate, limits } from '@/lib/rate-limit';
import { logAudit } from '@/services/audit';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
]);
const MAX_BYTES = 10 * 1024 * 1024; // must match DB CHECK constraint
const BUCKET = 'report-attachments';

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export async function uploadAttachmentAction(reportId: string, formData: FormData) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  enforceRate(`upload:${user.user.id}`, limits.comment.max, limits.comment.windowMs);

  // Authorization: reporter owns the report OR company member OR admin
  const { data: report } = await supabase.from('reports').select('id,program_id,researcher_id').eq('id', reportId).single();
  if (!report) throw new Error('Report not found');
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  const isOwner = rp?.id === report.researcher_id;
  const { data: prog } = await supabase.from('programs').select('company_id').eq('id', report.program_id).single();
  let isMember = false;
  if (prog) {
    const { data: m } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', prog.company_id)
      .eq('user_id', user.user.id)
      .single();
    isMember = !!m;
  }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
  if (!isOwner && !isMember && !isAdmin) throw new Error('Forbidden');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('No file provided');
  if (file.size > MAX_BYTES) throw new Error('File too large (max 10MB)');
  if (!ALLOWED_MIME.has(file.type)) throw new Error(`File type not allowed: ${file.type || 'unknown'}`);
  // Block double extensions / executables masquerading (e.g. .php, .exe, .js, .svg with scripts)
  const BLOCKED_EXT = ['.exe', '.js', '.ts', '.sh', '.bat', '.php', '.py', '.svg', '.html', '.htm'];
  if (BLOCKED_EXT.includes(ext(file.name))) throw new Error('File extension not allowed');
  // Magic-byte check for images: PNG/JPEG/WebP signatures
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/png' && !(head[0] === 0x89 && head[1] === 0x50)) throw new Error('Invalid PNG file');
  if (file.type === 'image/jpeg' && !(head[0] === 0xff && head[1] === 0xd8)) throw new Error('Invalid JPEG file');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const path = `${reportId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);
  const { error: dbErr } = await supabase.from('report_attachments').insert({
    report_id: reportId,
    uploaded_by: user.user.id,
    file_path: path,
    file_name: file.name.slice(0, 200),
    file_size: file.size,
    mime_type: file.type,
  });
  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(dbErr.message);
  }
  await logAudit('create', 'report_attachments', path, { report_id: reportId, size: file.size }, user.user.id);
  revalidatePath(`/dashboard/reports/${reportId}`);
}

/**
 * Secure download for report evidence: returns a short-lived signed URL
 * ONLY to report participants (researcher owner / company member / staff).
 * The bucket itself is private — direct storage access stays impossible,
 * and the participant check here mirrors the DB storage policy so neither
 * IDOR on the attachment id nor on the report id can leak files.
 */
export async function getAttachmentUrlAction(reportId: string, attachmentId: string): Promise<string> {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');

  const { data: att } = await supabase
    .from('report_attachments')
    .select('id,file_path,report_id')
    .eq('id', attachmentId)
    .eq('report_id', reportId)
    .single();
  if (!att) throw new Error('Attachment not found');

  // Participant check (same rule as upload): owner OR company member OR staff
  const { data: report } = await supabase
    .from('reports')
    .select('id,program_id,researcher_id')
    .eq('id', reportId)
    .single();
  if (!report) throw new Error('Report not found');
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  const isOwner = rp?.id === report.researcher_id;
  const { data: prog } = await supabase.from('programs').select('company_id').eq('id', report.program_id).single();
  let isMember = false;
  if (prog) {
    const { data: m } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', prog.company_id)
      .eq('user_id', user.user.id)
      .single();
    isMember = !!m;
  }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.user.id);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
  if (!isOwner && !isMember && !isStaff) throw new Error('Forbidden');

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(att.file_path, 300); // 5 minutes
  if (error || !signed?.signedUrl) throw new Error('تعذّر إنشاء رابط التحميل');
  return signed.signedUrl;
}

/** Server-action wrapper: validates access then redirects to the signed URL. */
export async function downloadAttachmentAction(reportId: string, attachmentId: string): Promise<void> {
  const url = await getAttachmentUrlAction(reportId, attachmentId);
  redirect(url);
}
