import { createServerClient } from '@/lib/supabase/server';
import { addCommentAction, submitReportAction } from '@/features/reports/services';
import { openDisputeAction } from '@/features/disputes/services';
import { uploadAttachmentAction } from '@/features/reports/attachments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { StatusPill } from '@/components/shared/status-pill';
import { CopyButton } from '@/components/shared/copy-button';
import { ReportStepper } from '@/components/reports/report-stepper';

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { id: reportId } = await params;
  const { data: report } = await supabase.from('reports').select('*').eq('id', reportId).single();
  if (!report) return <main className="container py-12">Report not found.</main>;
  const [{ data: comments }, { data: events }, { data: attachments }, { data: award }, { data: payments }] = await Promise.all([
    supabase.from('report_comments').select('id,body,created_at').eq('report_id', reportId).order('created_at'),
    supabase.from('report_events').select('id,from_status,to_status,note,created_at').eq('report_id', reportId).order('created_at'),
    supabase.from('report_attachments').select('id,file_name,file_size,mime_type,created_at').eq('report_id', reportId).order('created_at'),
    supabase.from('bounty_awards').select('id,amount,status,decided_at').eq('report_id', reportId).single(),
    supabase.from('bounty_awards').select('id,bounty_payments(reference,status)').eq('report_id', reportId).single(),
  ]);
  const paymentRef = (payments as unknown as { bounty_payments: { reference: string | null; status: string }[] } | null)?.bounty_payments?.[0]?.reference;

  return (
    <main className="py-2 max-w-3xl space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm text-muted-foreground" dir="ltr">{report.report_number}</p>
          <CopyButton text={report.report_number} label="نسخ الرقم" />
        </div>
        <h1 className="mt-2 text-xl font-black tracking-tight">{report.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill value={report.status} />
          <StatusPill value={report.severity} kind="severity" />
          {report.cvss_score != null && <span className="text-xs text-muted-foreground" dir="ltr">CVSS {Number(report.cvss_score).toFixed(1)}</span>}
        </div>
        <Card className="mt-4"><CardContent className="p-4"><ReportStepper status={report.status} /></CardContent></Card>
        {award && (
          <Card className="mt-4 border-amber-400/50">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="text-sm text-muted-foreground">المكافأة</p>
                <p className="text-2xl font-black tabular-nums" dir="ltr">{Number(award.amount).toLocaleString()} EGP</p>
              </div>
              <div className="text-left">
                <StatusPill value={award.status} />
                {paymentRef && <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">ref: {paymentRef}</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Card><CardHeader><CardTitle className="text-sm">الملخص</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed">{report.summary}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">التفاصيل الفنية</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p><span className="font-bold">الأصل المتأثر:</span> <span dir="ltr">{report.affected_asset}</span></p>
          <p className="whitespace-pre-wrap">{report.description}</p>
          <p><span className="font-bold">الأثر:</span> {report.impact}</p>
          <p><span className="font-bold">خطوات الاستنساخ:</span> <span className="whitespace-pre-wrap">{report.reproduction_steps}</span></p>
          {report.remediation && <p><span className="font-bold">المقترح العلاجي:</span> {report.remediation}</p>}
        </CardContent>
      </Card>
      {report.status === 'draft' && (
        <form action={submitReportAction.bind(null, report.id)}>
          <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-700">تقديم التقرير للمراجعة</Button>
        </form>
      )}
      <Card><CardHeader><CardTitle className="text-sm">السجل الزمني</CardTitle></CardHeader>
        <CardContent>
          {!events?.length ? <p className="text-sm text-muted-foreground">لا توجد أحداث بعد.</p> : (
            <ol className="relative space-y-3 border-r pr-4">
              {events.map((e: { id: string; from_status: string | null; to_status: string | null; note: string | null }) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute -right-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300" />
                  {e.to_status ? (
                    <><StatusPill value={e.from_status ?? 'draft'} /> <span className="text-muted-foreground">←</span> <StatusPill value={e.to_status} /></>
                  ) : (
                    <span className="text-muted-foreground">{e.note}</span>
                  )}
                  {e.to_status && e.note && <p className="mt-1 text-xs text-muted-foreground">{e.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-sm">المرفقات (خاصة — 10MB كحد أقصى)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!attachments?.length ? <p className="text-sm text-muted-foreground">لا توجد مرفقات.</p> :
            attachments.map((a) => <p key={a.id} className="rounded-md border p-2 text-sm">{a.file_name} <span className="text-muted-foreground">({a.mime_type}، {Math.round(a.file_size / 1024)}KB)</span></p>)}
          <form action={uploadAttachmentAction.bind(null, report.id)} className="flex flex-wrap items-center gap-2">
            <input type="file" name="file" required accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" className="text-sm" />
            <Button type="submit" size="sm">رفع</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-sm">فتح نزاع</CardTitle></CardHeader>
        <CardContent>
          <form action={openDisputeAction} className="space-y-2">
            <input type="hidden" name="report_id" value={report.id} />
            <Textarea name="reason" required placeholder="اشرح سبب اعتراضك على القرار (10 أحرف على الأقل)…" />
            <Button type="submit" size="sm" variant="outline">فتح النزاع</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-sm">التعليقات</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {comments?.map((c) => <div key={c.id} className="rounded-md border p-2.5 text-sm leading-relaxed">{c.body}</div>)}
          <form action={addCommentAction.bind(null, report.id)} className="space-y-2">
            <Textarea name="body" required placeholder="اكتب تعليقًا…" />
            <Button type="submit" size="sm">إضافة التعليق</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
