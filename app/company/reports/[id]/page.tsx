import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { triageReportAction, awardBountyAction, changeSeverityAction, markDuplicateAction, assignReportAction, unassignReportAction, toggleLabelAction } from '@/features/company/services';
import { addCommentAction } from '@/features/reports/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportStepper } from '@/components/reports/report-stepper';

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
    await supabase.from('conversation_members').insert([
      { conversation_id: convId, user_id: user.user.id },
      { conversation_id: convId, user_id: otherId },
    ]);
  }
  revalidatePath('/company/reports');
  redirect(`/company/messages?c=${convId}`);
}

export default async function CompanyReport({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { id } = await params;
  const { data: report } = await supabase.from('reports').select('*,programs(company_id,response_sla_hours)').eq('id', id).single();
  if (!report) return <main className="container py-12">Not found.</main>;
  const companyId = (report as unknown as { programs: { company_id: string } | null }).programs?.company_id ?? null;
  const [{ data: assignees }, { data: members }, { data: labels }, { data: attached }] = await Promise.all([
    supabase.from('report_assignees').select('user_id,profiles!inner(username)').eq('report_id', id),
    companyId ? supabase.from('company_members').select('user_id,role,profiles!inner(username)').eq('company_id', companyId) : Promise.resolve({ data: [] }),
    supabase.from('report_labels').select('id,name,color').order('name'),
    supabase.from('report_label_links').select('label_id').eq('report_id', id),
  ]);
  const attachedIds = new Set(((attached ?? []) as { label_id: string }[]).map((l) => l.label_id));
  const slaHours = (report as unknown as { programs: { response_sla_hours: number } | null }).programs?.response_sla_hours ?? 72;
  const submittedAt = report.submitted_at ? new Date(report.submitted_at).getTime() : null;
  const elapsedH = submittedAt ? (Date.now() - submittedAt) / 3_600_000 : null;
  const breached = elapsedH != null && elapsedH > slaHours && !['resolved', 'closed'].includes(report.status);
  const { data: comments } = await supabase.from('report_comments').select('*').eq('report_id', id).order('created_at');
  const { data: dups } = await supabase.from('report_duplicates').select('id,duplicate_of').eq('report_id', id);

  return (
    <main className="container py-8 max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{report.report_number} — {report.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{report.status}</Badge><Badge variant="secondary">{report.severity}</Badge>
            {elapsedH != null && (
              <Badge variant={breached ? 'destructive' : 'secondary'}>
                SLA {slaHours}h — مر {Math.floor(elapsedH)}h{breached ? ' (متجاوز!)' : ''}
              </Badge>
            )}
          </div>
        </div>
        <form action={contactResearcher.bind(null, report.id)}>
          <Button size="sm" variant="outline" type="submit">مراسلة الباحث</Button>
        </form>
      </div>
      <Card><CardContent className="p-4"><ReportStepper status={report.status} /></CardContent></Card>
      <Card><CardContent className="p-4 space-y-2"><p>{report.description}</p><p><b>Impact:</b> {report.impact}</p><p><b>Repro:</b> {report.reproduction_steps}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Triage</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {['triaged', 'accepted', 'resolved', 'duplicate', 'not_applicable', 'closed'].map((s) => (
            <form key={s} action={triageReportAction.bind(null, report.id, s)}>
              <Button size="sm" variant="outline" type="submit">{s}</Button>
            </form>
          ))}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>تغيير الخطورة (مع السبب)</CardTitle></CardHeader>
        <CardContent>
          <form action={changeSeverityAction.bind(null, report.id)} className="flex flex-wrap gap-2">
            <select name="severity" defaultValue={report.severity} className="h-10 border rounded-md px-3">
              <option value="informational">informational</option><option value="low">low</option>
              <option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option>
            </select>
            <Input name="reason" required minLength={5} placeholder="سبب التغيير (يُحفظ في السجل)" className="flex-1 min-w-[200px]" />
            <Button size="sm" type="submit">حفظ</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>تحديد كمكرر</CardTitle></CardHeader>
        <CardContent>
          {dups?.map((d) => <p key={d.id} className="mb-2 text-sm">مكرر من: <span dir="ltr" className="font-mono">{d.duplicate_of}</span></p>)}
          <form action={markDuplicateAction.bind(null, report.id)} className="flex gap-2">
            <Input name="duplicate_of" required placeholder="رقم الأصل MB-000001 أو UUID" dir="ltr" />
            <Button size="sm" type="submit">تحديد</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle>المكلفون</CardTitle></CardHeader><CardContent className="space-y-2">
          {((assignees ?? []) as unknown as { user_id: string; profiles: { username: string } }[]).map((a) => (
            <div key={a.user_id} className="flex items-center justify-between text-sm">
              <span dir="ltr">@{a.profiles.username}</span>
              <form action={unassignReportAction.bind(null, report.id, a.user_id)}>
                <Button size="sm" variant="ghost" type="submit">إزالة</Button>
              </form>
            </div>
          ))}
          <form action={assignReportAction.bind(null, report.id)} className="flex gap-2 pt-1">
            <select name="assignee_id" required defaultValue="" className="h-10 flex-1 rounded-md border px-2 text-sm">
              <option value="" disabled>اختر من الفريق…</option>
              {((members ?? []) as unknown as { user_id: string; role: string; profiles: { username: string } }[]).map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.profiles.username} ({m.role})</option>
              ))}
            </select>
            <Button size="sm" type="submit">تكليف</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>الوسوم</CardTitle></CardHeader><CardContent>
          <form action={toggleLabelAction.bind(null, report.id)} className="flex flex-wrap gap-2">
            {(labels ?? []).map((l: { id: string; name: string; color: string }) => (
              <button
                key={l.id}
                type="submit"
                name="label_id"
                value={l.id}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${attachedIds.has(l.id) ? 'text-white' : ''}`}
                style={attachedIds.has(l.id) ? { backgroundColor: l.color, borderColor: l.color } : { borderColor: l.color, color: l.color }}
              >
                {l.name}
              </button>
            ))}
          </form>
          <p className="mt-2 text-xs text-muted-foreground">اضغط الوسم لإضافته أو إزالته.</p>
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Award bounty (server-side, credits wallet)</CardTitle></CardHeader>
        <CardContent>
          <form action={awardBountyAction.bind(null, report.id)} className="flex gap-2">
            <Input name="amount" type="number" min={0} required placeholder="Amount EGP" />
            <Button type="submit">Award</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Comments ({comments?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {comments?.map((c: { id: string; body: string; is_internal: boolean }) => (
            <p key={c.id} className="mb-2 border rounded p-2 text-sm">
              {c.is_internal && <span className="mb-1 block text-xs font-bold text-amber-600">ملاحظة داخلية (لا يراها الباحث)</span>}
              {c.body}
            </p>
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
    </main>
  );
}
