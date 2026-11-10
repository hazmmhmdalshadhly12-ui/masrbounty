import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/admin-actions';
import { logAudit } from '@/services/audit';
import { canTransition, REASON_REQUIRED_STATUSES, REPORT_STATUS_LABELS, allowedTransitions, type ReportStatus } from '@/constants/statuses';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { StatusPill } from '@/components/shared/status-pill';
import { FileText, Flag, Check, X, Copy, Eye } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function staff() {
  // Re-verify staff role on every mutation (layout check alone is not enough).
  return requireStaff(['admin', 'moderator']);
}

async function triageReport(reportId: string, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const to = String(formData.get(`to_${reportId}`) ?? '').trim();
  const note = String(formData.get(`note_${reportId}`) ?? '').trim().slice(0, 1000);
  if (!to || !(to in REPORT_STATUS_LABELS)) throw new Error('حالة غير صالحة');

  // Fetch the current status and enforce the canonical lifecycle map.
  // Staff may reopen closed reports (closed → under_review); everything else
  // follows the same from → to rules as the company flow. The DB trigger
  // fn_enforce_report_transitions enforces this again at the storage layer.
  const { data: current } = await supabase.from('reports').select('status,report_number').eq('id', reportId).single();
  if (!current) throw new Error('التقرير غير موجود');
  if (!canTransition((current as { status: string }).status, to, { staff: true })) {
    throw new Error(`انتقال غير صالح: ${(current as { status: string }).status} ← ${to}`);
  }
  if ((REASON_REQUIRED_STATUSES as readonly string[]).includes(to as never) && note.length < 5) {
    throw new Error('سبب القرار مطلوب (5 أحرف على الأقل)');
  }

  // Duplicate link handling
  if (to === 'duplicate') {
    const dupOf = String(formData.get(`dup_${reportId}`) ?? '').trim();
    if (dupOf) {
      await supabase.from('report_duplicates').insert({ report_id: reportId, duplicate_of: dupOf, marked_by: user.id });
    }
  }

  const { error } = await supabase.from('reports').update({ status: to }).eq('id', reportId);
  if (error) throw new Error(error.message);

  // NOTE: no manual report_events insert — the DB trigger log_report_event
  // already records every status change (the old code wrote a duplicate row).
  // The decision reason is stored as its own timeline note event.
  if (note) {
    await supabase.from('report_events').insert({ report_id: reportId, actor_id: user.id, note: `سبب القرار (${REPORT_STATUS_LABELS[to as ReportStatus]?.ar ?? to}): ${note}` });
  }
  await supabase.from('moderation_actions').insert({ moderator_id: user.id, target_type: 'report', target_id: reportId, action: `triage:${to}`, reason: note || null });
  await logAudit('moderate', 'reports', reportId, { to, note }, user.id);

  // notify reporter
  try {
    const { data: r } = await supabase.from('reports').select('researcher_id,report_number').eq('id', reportId).single();
    if (r) {
      const { data: rp } = await supabase.from('researcher_profiles').select('user_id').eq('id', (r as { researcher_id: string }).researcher_id).single();
      if (rp) {
        const { notify } = await import('@/lib/notify');
        await notify(supabase, (rp as { user_id: string }).user_id, {
          type: 'report',
          title: `تحديث تقرير ${r.report_number}: ${REPORT_STATUS_LABELS[to as ReportStatus]?.ar ?? to}`,
          body: note || undefined,
          link: `/dashboard/reports/${reportId}`,
        });
      }
    }
  } catch {
    /* ignore */
  }

  revalidatePath('/admin/reports');
}

const statusAr: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_STATUS_LABELS).map(([k, v]) => [k, v.ar])
);

const severityAr: Record<string, string> = {
  critical: 'حرجة',
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
  informational: 'معلوماتية',
};

export default async function AdminReports({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; q?: string }>;
}) {
  const { status = 'needs_review', severity = '', q = '' } = await searchParams;
  const supabase = await createServerClient();

  // Build query — use report_overview view for richer data when available
  let query = supabase.from('reports').select('id,report_number,title,status,severity,bounty_amount,created_at,program_id,researcher_id').order('created_at', { ascending: false }).limit(80);

  if (status === 'needs_review') {
    query = query.in('status', ['submitted', 'under_review', 'triaged', 'need_more_info']);
  } else if (status !== 'all' && status) {
    query = query.eq('status', status);
  }
  if (severity) query = query.eq('severity', severity);
  if (q.trim()) {
    const esc = q.trim().replace(/[%_\\]/g, '\\$&');
    query = query.or(`title.ilike.%${esc}%,report_number.ilike.%${esc}%`);
  }

  const { data: reports, error } = await query;
  const rows = (reports ?? []) as {
    id: string;
    report_number: string;
    title: string;
    status: string;
    severity: string;
    bounty_amount: number | null;
    created_at: string;
    program_id: string;
    researcher_id: string;
  }[];

  // Enrich with program/researcher names via extra fetches (avoid view dependency)
  const programIds = [...new Set(rows.map((r) => r.program_id))];
  const researcherIds = [...new Set(rows.map((r) => r.researcher_id))];
  let progMap: Record<string, { name: string; slug: string }> = {};
  let researcherMap: Record<string, string> = {};
  if (programIds.length) {
    const { data: progs } = await supabase.from('programs').select('id,name,slug').in('id', programIds);
    for (const p of (progs ?? []) as { id: string; name: string; slug: string }[]) progMap[p.id] = { name: p.name, slug: p.slug };
  }
  if (researcherIds.length) {
    const { data: rps } = await supabase.from('researcher_profiles').select('id,display_name').in('id', researcherIds);
    for (const r of (rps ?? []) as { id: string; display_name: string }[]) researcherMap[r.id] = r.display_name;
  }

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={FileText} title="إدارة التقارير" desc="فرز التقارير — مقدّمة / مفرزة تحتاج مراجعة، مع إجراءات ترياج وتسجيل تدقيق" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">فلترة</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2">
            <select name="status" defaultValue={status} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="needs_review">تحتاج مراجعة</option>
              <option value="all">الكل</option>
              {(['submitted','under_review','triaged','need_more_info','accepted','reward_approved','paid','resolved','rejected','duplicate','informative','not_applicable','spam','closed','draft'] as const).map((s) => (
                <option key={s} value={s}>{REPORT_STATUS_LABELS[s].ar}</option>
              ))}
            </select>
            <select name="severity" defaultValue={severity} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">كل الخطورة</option>
              <option value="critical">حرجة</option>
              <option value="high">عالية</option>
              <option value="medium">متوسطة</option>
              <option value="low">منخفضة</option>
              <option value="informational">معلوماتية</option>
            </select>
            <Input name="q" defaultValue={q} placeholder="بحث بالعنوان أو الرقم المرجعي…" className="h-9 w-56" />
            <Button size="sm" variant="outline" type="submit">
              تطبيق
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error.message}</p>}
        </CardContent>
      </Card>

      {!rows.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">لا توجد تقارير بهذه الفلترة.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold" dir="ltr">
                        {r.report_number}
                      </span>
                      <StatusPill value={r.status} />
                      <StatusPill value={r.severity} kind="severity" />
                      {r.bounty_amount != null && Number(r.bounty_amount) > 0 && <Badge variant="outline">{Number(r.bounty_amount).toLocaleString()} EGP</Badge>}
                    </div>
                    <Link href={`/dashboard/reports/${r.id}`} className="mt-1 block truncate text-sm font-bold hover:underline">
                      {r.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        البرنامج: <b>{progMap[r.program_id]?.name ?? r.program_id.slice(0, 8)}</b>
                      </span>
                      <span>· الباحث: {researcherMap[r.researcher_id] ?? r.researcher_id.slice(0, 8)}</span>
                      <span>· {new Date(r.created_at).toLocaleString('ar-EG')}</span>
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href={`/dashboard/reports/${r.id}`}>
                      <Eye className="ml-1 h-3 w-3" /> عرض
                    </Link>
                  </Button>
                </div>

                <form action={triageReport.bind(null, r.id)} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <select name={`to_${r.id}`} defaultValue={r.status === 'submitted' ? 'triaged' : 'accepted'} className="h-8 rounded-md border bg-background px-2 text-xs">
                    {allowedTransitions(r.status, { staff: true }).map((s) => (
                      <option key={s} value={s}>{REPORT_STATUS_LABELS[s].ar}</option>
                    ))}
                  </select>
                  <Input name={`dup_${r.id}`} placeholder="معرّف التقرير الأصلي (للمكرر)" className="h-8 w-56 text-xs" dir="ltr" />
                  <Input name={`note_${r.id}`} placeholder="سبب القرار / ملاحظة الترياج" className="h-8 flex-1 text-xs" />
                  <Button size="sm" type="submit" className="bg-slate-900 text-white hover:bg-slate-700">
                    <Check className="ml-1 h-3 w-3" /> تطبيق
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
