import { createServerClient } from '@/lib/supabase/server';
import { resolveDisputeAction } from '@/features/disputes/services';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { Scale, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const statusAr: Record<string, string> = {
  open: 'مفتوح',
  under_review: 'قيد المراجعة',
  resolved: 'محلول',
  rejected: 'مرفوض',
};

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'queue' } = await searchParams;
  const supabase = await createServerClient();

  let query = supabase.from('disputes').select('id,report_id,opened_by,reason,status,resolution,created_at,resolved_by').order('created_at', { ascending: false }).limit(80);
  if (status === 'queue') query = query.in('status', ['open', 'under_review']);
  else if (['open', 'under_review', 'resolved', 'rejected'].includes(status)) query = query.eq('status', status);

  const { data, error } = await query;
  const rows = (data ?? []) as { id: string; report_id: string; opened_by: string; reason: string; status: string; resolution: string | null; created_at: string; resolved_by: string | null }[];

  // fetch related report numbers + messages counts
  const reportIds = [...new Set(rows.map((r) => r.report_id))];
  let reportMap: Record<string, { report_number: string; title: string }> = {};
  if (reportIds.length) {
    const { data: reports } = await supabase.from('reports').select('id,report_number,title').in('id', reportIds);
    for (const r of (reports ?? []) as { id: string; report_number: string; title: string }[]) reportMap[r.id] = r;
  }

  // dispute_messages per dispute (latest 3)
  let messagesByDispute: Record<string, { id: string; body: string; created_at: string }[]> = {};
  if (rows.length) {
    const { data: msgs } = await supabase.from('dispute_messages').select('id,dispute_id,body,created_at').in('dispute_id', rows.map((r) => r.id)).order('created_at', { ascending: true }).limit(200);
    for (const m of (msgs ?? []) as { id: string; dispute_id: string; body: string; created_at: string }[]) {
      if (!messagesByDispute[m.dispute_id]) messagesByDispute[m.dispute_id] = [];
      messagesByDispute[m.dispute_id].push({ id: m.id, body: m.body, created_at: m.created_at });
    }
  }

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={Scale} title="النزاعات" desc="طابور النزاعات — مراجعة، رسائل، وقرار (مقبول/مرفوض) مع تسجيل إشرافي" />

      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          {[
            ['queue', 'قيد الانتظار (مفتوح + قيد المراجعة)'],
            ['open', 'مفتوح'],
            ['under_review', 'قيد المراجعة'],
            ['resolved', 'محلول'],
            ['rejected', 'مرفوض'],
            ['all', 'الكل'],
          ].map(([v, label]) => (
            <Link
              key={v}
              href={`/admin/disputes?status=${v}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${status === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-accent'}`}
            >
              {label}
            </Link>
          ))}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!rows.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">لا توجد نزاعات بهذه الحالة.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((d) => (
            <Card key={d.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={d.status === 'open' || d.status === 'under_review' ? 'destructive' : 'secondary'}>{statusAr[d.status] ?? d.status}</Badge>
                  <span className="font-mono text-xs" dir="ltr">
                    {reportMap[d.report_id]?.report_number ?? d.report_id.slice(0, 8)} — {reportMap[d.report_id]?.title ?? '—'}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{new Date(d.created_at).toLocaleString('ar-EG')}</span>
                </CardTitle>
                <CardDescription className="text-xs">معرّف النزاع: <span dir="ltr" className="font-mono">{d.id.slice(0, 8)}</span> · التقرير: <span dir="ltr" className="font-mono">{d.report_id.slice(0, 8)}</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-lg border bg-muted/20 p-3 text-sm leading-relaxed">{d.reason}</p>

                {messagesByDispute[d.id]?.length ? (
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 flex items-center gap-1 text-xs font-bold">
                      <MessageSquare className="h-3 w-3" /> رسائل النزاع ({messagesByDispute[d.id].length})
                    </p>
                    <ul className="space-y-1.5">
                      {messagesByDispute[d.id].slice(-5).map((m) => (
                        <li key={m.id} className="rounded bg-muted/30 p-2 text-xs">
                          {m.body}
                          <span className="block text-[11px] text-muted-foreground">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {d.status === 'open' || d.status === 'under_review' ? (
                  <form action={resolveDisputeAction.bind(null, d.id)} className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
                    <Input name="resolution" required placeholder="حيثيات القرار — تُرسل للطرفين وتُسجل تدقيقيًا" className="h-9 flex-1 text-xs" />
                    <select name="status" className="h-9 rounded-md border bg-background px-2 text-xs">
                      <option value="resolved">محلول (لصالح الباحث)</option>
                      <option value="rejected">مرفوض</option>
                    </select>
                    <Button size="sm" type="submit" className="bg-slate-900 text-white hover:bg-slate-700">
                      <CheckCircle2 className="ml-1 h-3 w-3" /> اعتماد القرار
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-lg border bg-muted/10 p-3 text-sm">
                    <p className="flex items-center gap-1 font-bold">
                      {d.status === 'resolved' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />} القرار: {statusAr[d.status] ?? d.status}
                    </p>
                    <p className="mt-1 text-muted-foreground">{d.resolution ?? '—'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
