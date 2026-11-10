import { revalidatePath } from 'next/cache';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { triageReportAction, changeSeverityAction, markDuplicateAction, toggleLabelAction } from '@/features/company/services';
import { downloadAttachmentAction } from '@/features/reports/attachments';
import { RewardApproval } from '@/components/company/reward-approval';
import { assignReportAction as legacyAssign, unassignReportAction as legacyUnassign } from '@/features/company/services';
import { assignReport, unassignReport } from '@/services/assignment';
import { addCommentAction } from '@/features/reports/services';
import { allowedTransitions, REASON_REQUIRED_STATUSES, REPORT_STATUS_LABELS, SEVERITY_LABELS, type ReportStatus } from '@/constants/statuses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportStepper } from '@/components/reports/report-stepper';
import { StatusPill } from '@/components/shared/status-pill';
import { Avatar } from '@/components/shared/avatar';
import { timeAgo } from '@/utils/time';
import { getSLAStatus, getDueDate, slaIcon, slaLabel } from '@/lib/sla';
import { SLABadge } from '@/components/company/sla-badge';

async function contactResearcher(reportId: string) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: report } = await supabase.from('reports').select('researcher_id,researcher_profiles!inner(user_id)').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  const otherId = (report as unknown as { researcher_profiles: { user_id: string } }).researcher_profiles.user_id;
  // Reuse existing 1:1 conversation if present
  const { data: mine } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.user.id);
  const ids = (mine ?? []).map((m: { conversation_id: string }) => m.conversation_id);
  let convId: string | null = null;
  if (ids.length) {
    const { data: shared } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', otherId)
      .in('conversation_id', ids)
      .limit(1);
    convId = shared?.[0]?.conversation_id ?? null;
  }
  if (!convId) {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ subject: `تقرير ${reportId.slice(0, 8)}`, report_id: reportId, created_by: user.user.id })
      .select('id')
      .single();
    if (error || !conv) throw new Error('Failed to start conversation');
    convId = conv.id;
    const { error: selfErr } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: convId, user_id: user.user.id });
    if (selfErr) throw new Error(selfErr.message);
    const { error: otherErr } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: convId, user_id: otherId });
    if (otherErr) throw new Error(otherErr.message);
  }
  revalidatePath('/company/reports');
  redirect(`/company/messages?c=${convId}`);
}

export default async function CompanyReport({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { id } = await params;
  const { data: user } = await supabase.auth.getUser();
  const { data: report } = await supabase.from('reports').select('*,programs(company_id,response_sla_hours)').eq('id', id).single();
  if (!report) notFound();
  const companyId = (report as unknown as { programs: { company_id: string } | null }).programs?.company_id ?? null;

  // Explicit server-side authorization: must belong to the owning company.
  if (companyId && user.user) {
    const [{ data: membership }, { data: owned }] = await Promise.all([
      supabase.from('company_members').select('id').eq('company_id', companyId).eq('user_id', user.user.id).maybeSingle(),
      supabase.from('company_profiles').select('id').eq('id', companyId).eq('owner_id', user.user.id).maybeSingle(),
    ]);
    if (!membership && !owned) notFound();
  } else if (!user.user) {
    notFound();
  }
  const [{ data: assignees }, { data: members }, { data: labels }, { data: attached }] = await Promise.all([
    supabase.from('report_assignees').select('user_id,profiles!inner(username)').eq('report_id', id),
    companyId ? supabase.from('company_members').select('user_id,role,profiles!inner(username)').eq('company_id', companyId) : Promise.resolve({ data: [] }),
    supabase.from('report_labels').select('id,name,color').order('name'),
    supabase.from('report_label_links').select('label_id').eq('report_id', id),
  ]);
  const attachedIds = new Set(((attached ?? []) as { label_id: string }[]).map((l) => l.label_id));
  // SLA via lib/sla (24h response, 72h triage, 14d resolution)
  const slaStatus = getSLAStatus({ status: report.status, created_at: report.created_at, submitted_at: report.submitted_at } as never);
  const slaDueResponse = getDueDate({ status: report.status, created_at: report.created_at, submitted_at: report.submitted_at } as never, 'response');
  const slaDueTriage = getDueDate({ status: report.status, created_at: report.created_at, submitted_at: report.submitted_at } as never, 'triage');
  const slaDueResolution = getDueDate({ status: report.status, created_at: report.created_at, submitted_at: report.submitted_at } as never, 'resolution');
  const { data: comments } = await supabase.from('report_comments').select('id,body,is_internal,created_at,profiles!inner(username)').eq('report_id', id).order('created_at');
  const { data: dups } = await supabase.from('report_duplicates').select('id,duplicate_of').eq('report_id', id);
  const { data: attachments } = await supabase.from('report_attachments').select('id,file_name,file_size,mime_type,created_at').eq('report_id', id).order('created_at');

  // Lifecycle-aware triage: only transitions valid FROM the current status
  // are offered (mirrors the DB trigger fn_enforce_report_transitions).
  const nextStatuses = allowedTransitions(report.status);
  const reasonRequired = (s: string) => (REASON_REQUIRED_STATUSES as readonly string[]).includes(s);

  // Smart-wallet data for the reward approval flow (spec A): effective
  // commission rate, available balance, and any locked-in reward.
  let rateBp: number | null = null;
  let availableMinor: number | null = null;
  let rewardData: unknown = null;
  let canAct = false;
  if (companyId && user.user) {
    const [{ data: roleRow }, { data: rateRow }, { data: walletRow }, { data: rewardRow }] = await Promise.all([
      supabase.from('company_members').select('role').eq('company_id', companyId).eq('user_id', user.user.id).maybeSingle(),
      supabase.rpc('get_effective_commission_rate', { p_company: companyId }),
      supabase.from('company_wallets').select('available_balance_minor').eq('company_id', companyId).maybeSingle(),
      supabase.from('bounty_rewards').select('*').eq('report_id', id).maybeSingle(),
    ]);
    const role = (roleRow as { role: string } | null)?.role ?? null;
    canAct = ['owner', 'admin', 'finance'].includes(role ?? '');
    if (rateRow !== null && rateRow !== undefined) rateBp = rateRow as unknown as number;
    availableMinor = (walletRow as { available_balance_minor: number } | null)?.available_balance_minor ?? 0;
    rewardData = rewardRow;
  }

  return (
    <div className="container py-8 max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{report.report_number} — {report.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{report.status}</Badge><Badge variant="secondary">{report.severity}</Badge>
            <SLABadge report={{ status: report.status, created_at: report.created_at, submitted_at: report.submitted_at } as never} />
            <Badge variant="outline" className="font-mono text-xs" dir="ltr">{slaIcon(slaStatus)} {slaLabel(slaStatus)}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <span>استجابة 24س: {slaDueResponse ? slaDueResponse.toLocaleString('ar-EG') : '—'}</span>
            <span>·</span>
            <span>فرز 72س: {slaDueTriage ? slaDueTriage.toLocaleString('ar-EG') : '—'}</span>
            <span>·</span>
            <span>حل 14ي: {slaDueResolution ? slaDueResolution.toLocaleString('ar-EG') : '—'}</span>
          </div>
        </div>
        <form action={contactResearcher.bind(null, report.id)}>
          <Button size="sm" variant="outline" type="submit">مراسلة الباحث</Button>
        </form>
      </div>
      <Card><CardContent className="p-4"><ReportStepper status={report.status} /></CardContent></Card>
      <Card><CardContent className="p-4 space-y-2"><p>{report.description}</p><p><b>Impact:</b> {report.impact}</p><p><b>Repro:</b> {report.reproduction_steps}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>إدارة الحالة — دورة حياة التقرير</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">الحالة الحالية: <StatusPill value={report.status} /></p>
          {nextStatuses.length ? (
            <form action={triageReportAction.bind(null, report.id)} className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <select name="status" required defaultValue="" aria-label="اختر الحالة الجديدة" className="h-10 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="" disabled>اختر الحالة الجديدة…</option>
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>{REPORT_STATUS_LABELS[s].ar}{reasonRequired(s) ? ' — يتطلب سببًا' : ''}</option>
                  ))}
                </select>
                <Button size="sm" type="submit" aria-label="تطبيق تغيير الحالة">تطبيق</Button>
              </div>
              <Textarea name="reason" placeholder="سبب القرار — مطلوب عند الرفض/المكرر/غير المنطبق/غير الجاد، ويُحفظ في سجل التقرير ويرسل للباحث" aria-label="سبب تغيير الحالة" />
              <p className="text-xs text-muted-foreground">الانتقالات تتبع دورة حياة التقرير المعتمدة — لا يمكن القفز إلى حالة غير منطقية (محمي على الخادم وقاعدة البيانات معًا).</p>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد انتقالات متاحة من الحالة الحالية {REPORT_STATUS_LABELS[report.status as ReportStatus]?.ar ?? report.status}.{report.status === 'closed' ? ' الإغلاق نهائي — إعادة الفتح تتم من إدارة المنصة فقط عند وجود نزاع.' : ''}</p>
          )}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>تغيير الخطورة (مع السبب)</CardTitle></CardHeader>
        <CardContent>
          <form action={changeSeverityAction.bind(null, report.id)} className="flex flex-wrap gap-2">
            <select name="severity" defaultValue={report.severity} aria-label="اختر الخطورة الجديدة" className="h-10 border rounded-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {(['informational','low','medium','high','critical'] as const).map((s) => (
                <option key={s} value={s}>{SEVERITY_LABELS[s].ar}</option>
              ))}
            </select>
            <Input name="reason" required minLength={5} placeholder="سبب التغيير (يُحفظ في السجل)" aria-label="سبب تغيير الخطورة" className="flex-1 min-w-[200px]" />
            <Button size="sm" type="submit" aria-label="حفظ تغيير الخطورة">حفظ</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>تحديد كمكرر</CardTitle></CardHeader>
        <CardContent>
          {dups?.map((d) => <p key={d.id} className="mb-2 text-sm">مكرر من: <span dir="ltr" className="font-mono">{d.duplicate_of}</span></p>)}
          <form action={markDuplicateAction.bind(null, report.id)} className="flex gap-2">
            <Input name="duplicate_of" required placeholder="رقم الأصل MB-000001 أو UUID" dir="ltr" aria-label="رقم التقرير الأصلي للمكرر" />
            <Button size="sm" type="submit" aria-label="تحديد التقرير كمكرر">تحديد</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card><CardHeader><CardTitle>المكلفون — RBAC triager+</CardTitle></CardHeader><CardContent className="space-y-2">
          {((assignees ?? []) as unknown as { user_id: string; profiles: { username: string } }[]).map((a) => (
            <div key={a.user_id} className="flex items-center justify-between text-sm">
              <span dir="ltr">@{a.profiles.username}</span>
              <form action={async () => { 'use server'; await unassignReport(report.id, a.user_id); }}>
                <Button size="sm" variant="ghost" type="submit" aria-label={`إزالة تكليف ${a.profiles.username}`}>إزالة</Button>
              </form>
            </div>
          ))}
          <form action={async (fd: FormData) => { 'use server'; await assignReport(report.id, String(fd.get('assignee_id') ?? '')); }} className="flex gap-2 pt-1">
            <select name="assignee_id" required defaultValue="" aria-label="اختر عضو الفريق للتكليف" className="h-10 flex-1 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="" disabled>اختر من الفريق…</option>
              {((members ?? []) as unknown as { user_id: string; role: string; profiles: { username: string } }[]).map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.profiles.username} ({m.role})</option>
              ))}
            </select>
            <Button size="sm" type="submit" aria-label="تكليف العضو المحدد">تكليف</Button>
          </form>
          <p className="text-xs text-muted-foreground">التكليف/إعادة التكليف/الإلغاء يتطلب دور triager فأعلى — يُتحقق عبر company_members و owner.</p>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>الوسوم</CardTitle></CardHeader><CardContent>
          <form action={toggleLabelAction.bind(null, report.id)} className="flex flex-wrap gap-2">
            {(labels ?? []).map((l: { id: string; name: string; color: string }) => (
              <button
                key={l.id}
                type="submit"
                name="label_id"
                value={l.id}
                aria-pressed={attachedIds.has(l.id)}
                aria-label={`${attachedIds.has(l.id) ? 'إزالة' : 'إضافة'} الوسم ${l.name}`}
                className={`rounded-full border px-3 py-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${attachedIds.has(l.id) ? 'text-white' : ''}`}
                style={attachedIds.has(l.id) ? { backgroundColor: l.color, borderColor: l.color } : { borderColor: l.color, color: l.color }}
              >
                {l.name}
              </button>
            ))}
          </form>
          <p className="mt-2 text-xs text-muted-foreground">اضغط الوسم لإضافته أو إزالته.</p>
        </CardContent></Card>
      </div>
      <RewardApproval
        reportId={report.id}
        reportStatus={report.status}
        rateBp={rateBp}
        availableMinor={availableMinor}
        existingReward={(rewardData as unknown as import('@/types/wallet').BountyReward | null) ?? null}
        canAct={canAct}
      />
      <Card><CardHeader><CardTitle>المرفقات والأدلة ({attachments?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!attachments?.length ? <p className="text-sm text-muted-foreground">لا توجد مرفقات.</p> : (
            ((attachments ?? []) as { id: string; file_name: string; file_size: number; mime_type: string; created_at: string }[]).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="min-w-0 truncate">{a.file_name} <span className="text-muted-foreground">({a.mime_type}، {Math.round(a.file_size / 1024)}KB)</span></span>
                <form action={downloadAttachmentAction.bind(null, report.id, a.id)}>
                  <Button size="sm" variant="outline" type="submit" aria-label={`تحميل المرفق ${a.file_name}`}>تحميل آمن</Button>
                </form>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">الروابط موقعة وقصيرة الأجل (5 دقائق) — الدلو خاص ولا يمكن الوصول للمرفقات خارج صفحات الأطراف المخوّلين.</p>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>التعليقات ({comments?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {((comments ?? []) as unknown as { id: string; body: string; is_internal: boolean; created_at: string; profiles: { username: string } }[]).map((c) => (
            <div key={c.id} className="flex gap-2.5 rounded-md border p-2.5">
              <Avatar name={c.profiles.username} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground" dir="ltr">@{c.profiles.username}</span>
                  <span>{timeAgo(c.created_at)}</span>
                  {c.is_internal && <span className="font-bold text-amber-600">· داخلية (لا يراها الباحث)</span>}
                </p>
                <p className="mt-1 text-sm leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
          <form action={addCommentAction.bind(null, report.id)} className="mt-3 space-y-2">
            <Textarea name="body" required placeholder="Write a comment…" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_internal" className="h-4 w-4" /> ملاحظة داخلية للفريق فقط
            </label>
            <Button size="sm" type="submit">Comment</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
