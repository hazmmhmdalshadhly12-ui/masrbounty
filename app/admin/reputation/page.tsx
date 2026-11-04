import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth/guard';
import { PageHeader } from '@/components/shared/page-header';
import { FileBadge } from 'lucide-react';
import { ReputationAdmin, type AdminCertificateRow, type AdminLevelRow } from '@/components/admin/reputation-admin';

export const dynamic = 'force-dynamic';

export default async function AdminReputationPage() {
  await requireSession({ roles: ['admin', 'moderator'], next: '/admin' });
  const supabase = await createServerClient();
  const [{ data: roles }, { data: levels }, { data: certs }] = await Promise.all([
    supabase.from('user_roles').select('role'),
    supabase.from('researcher_levels').select('*').order('sort_order', { ascending: true }),
    supabase
      .from('certificates')
      .select('id, certificate_number, user_id, type, title_ar, status, created_at, revoked_reason')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  const staffRoles = new Set(((roles ?? []) as { role: string }[]).map((r) => r.role));
  const isAdmin = staffRoles.has('admin');
  if (!isAdmin && !staffRoles.has('moderator')) redirect('/admin');

  const levelRows: AdminLevelRow[] = ((levels ?? []) as Record<string, unknown>[]).map((l) => ({
    id: String(l['id']),
    code: String(l['code']),
    name_ar: String(l['name_ar'] ?? ''),
    name_en: (l['name_en'] as string | null) ?? '',
    min_score: Number(l['min_score'] ?? 0),
    min_accepted: Number(l['min_accepted'] ?? 0),
    requires_identity_verified: Boolean(l['requires_identity_verified']),
    is_active: Boolean(l['is_active']),
  }));

  const certRows: AdminCertificateRow[] = ((certs ?? []) as Record<string, unknown>[]).map((c) => ({
    id: String(c['id']),
    certificate_number: String(c['certificate_number'] ?? ''),
    user_id: String(c['user_id'] ?? ''),
    type: String(c['type'] ?? ''),
    title_ar: String(c['title_ar'] ?? ''),
    status: String(c['status'] ?? 'valid'),
    created_at: String(c['created_at'] ?? ''),
    revoked_reason: (c['revoked_reason'] as string | null) ?? null,
  }));

  // Enrich certificate holder names.
  const userIds = [...new Set(certRows.map((c) => c.user_id).filter(Boolean))];
  const { data: profs } = userIds.length
    ? await supabase.from('profiles').select('id, username, full_name').in('id', userIds)
    : { data: null };
  const profMap = new Map(((profs ?? []) as { id: string; username: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || p.username]));
  const holders: Record<string, string> = Object.fromEntries(
    certRows.map((c) => [c.id, profMap.get(c.user_id) ?? '—'])
  );

  return (
    <div className="space-y-6">
      <PageHeader icon={FileBadge} title="السمعة والمستويات والشهادات" desc="تعديل النقاط (كل تعديل يُسجّل في سجل السمعة غير القابل للتغيير)، إدارة المستويات، إصدار/إلغاء شهادات الإنجاز الموثقة." />
      <ReputationAdmin isAdmin={isAdmin} levels={levelRows} certificates={certRows} holders={holders} />
    </div>
  );
}
