import { createServerClient } from '@/lib/supabase/server';
import { addCommentAction, submitReportAction } from '@/features/reports/services';
import { openDisputeAction } from '@/features/disputes/services';
import { uploadAttachmentAction } from '@/features/reports/attachments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default async function ReportDetail({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: report } = await supabase.from('reports').select('*').eq('id', params.id).single();
  if (!report) return <main className="container py-12">Report not found.</main>;
  const [{ data: comments }, { data: events }, { data: attachments }] = await Promise.all([
    supabase.from('report_comments').select('id,body,created_at').eq('report_id', params.id).order('created_at'),
    supabase.from('report_events').select('id,from_status,to_status,created_at').eq('report_id', params.id).order('created_at'),
    supabase.from('report_attachments').select('id,file_name,file_size,mime_type,created_at').eq('report_id', params.id).order('created_at'),
  ]);

  return (
    <main className="container py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{report.report_number} — {report.title}</h1>
        <div className="flex gap-2 mt-2"><Badge>{report.status}</Badge><Badge variant="secondary">{report.severity}</Badge></div>
      </div>
      <Card><CardHeader><CardTitle>Summary</CardTitle></CardHeader><CardContent><p>{report.summary}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Description / Impact / Repro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p><b>Asset:</b> {report.affected_asset}</p>
          <p>{report.description}</p>
          <p><b>Impact:</b> {report.impact}</p>
          <p><b>Repro:</b> {report.reproduction_steps}</p>
          {report.remediation && <p><b>Fix:</b> {report.remediation}</p>}
        </CardContent>
      </Card>
      {report.status === 'draft' && (
        <form action={submitReportAction.bind(null, report.id)}>
          <Button type="submit">Submit report</Button>
        </form>
      )}
      <Card><CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent>{!events?.length ? <p className="text-sm text-muted-foreground">No events.</p> : events.map((e) => <p key={e.id} className="text-sm">{e.from_status} → {e.to_status}</p>)}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Attachments (private, max 10MB)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!attachments?.length ? <p className="text-sm text-muted-foreground">No attachments.</p> :
            attachments.map((a) => <p key={a.id} className="text-sm border rounded p-2">{a.file_name} ({a.mime_type}, {Math.round(a.file_size / 1024)}KB)</p>)}
          <form action={uploadAttachmentAction.bind(null, report.id)} className="flex gap-2 items-center">
            <input type="file" name="file" required accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" className="text-sm" />
            <Button type="submit" size="sm">Upload</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Open a dispute</CardTitle></CardHeader>
        <CardContent>
          <form action={openDisputeAction} className="space-y-2">
            <input type="hidden" name="report_id" value={report.id} />
            <Textarea name="reason" required placeholder="Why are you disputing the decision? (10+ chars)" />
            <Button type="submit" size="sm" variant="outline">Open dispute</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Comments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {comments?.map((c) => <div key={c.id} className="border rounded p-2 text-sm">{c.body}</div>)}
          <form action={addCommentAction.bind(null, report.id)} className="space-y-2">
            <Textarea name="body" required placeholder="Add a comment…" />
            <Button type="submit" size="sm">Add comment</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
