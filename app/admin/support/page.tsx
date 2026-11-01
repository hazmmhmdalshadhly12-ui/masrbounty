import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/admin-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LifeBuoy } from 'lucide-react';

const STATUS_AR: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد المعالجة',
  resolved: 'تم الحل',
  closed: 'مغلقة',
};

async function reply(ticketId: string, formData: FormData) {
  'use server';
  const { supabase, user } = await requireStaff(['admin', 'moderator']);
  const body = String(formData.get('body') ?? '').trim();
  if (!body) redirect('/admin/support?error=' + encodeURIComponent('لا يمكن إرسال رد فارغ'));
  await supabase.from('support_messages').insert({ ticket_id: ticketId, author_id: user.id, body });
  await supabase.from('support_tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', ticketId);
  revalidatePath('/admin/support');
}

async function setStatus(ticketId: string, status: string) {
  'use server';
  const { supabase } = await requireStaff(['admin', 'moderator']);
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) return;
  await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
  revalidatePath('/admin/support');
}

export default async function Support({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id,subject,status,created_at,updated_at,user_id,profiles!support_tickets_user_id_fkey(username,full_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  const ticketRows = (tickets ?? []) as unknown as {
    id: string;
    subject: string;
    status: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    profiles: { username: string; full_name: string | null } | null;
  }[];

  // Conversation of every ticket in one query (RLS: staff read)
  const ticketIds = ticketRows.map((t) => t.id);
  const msgMap = new Map<string, { id: string; body: string; author_id: string; created_at: string; is_staff?: boolean }[]>();
  if (ticketIds.length) {
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('id,ticket_id,body,author_id,created_at,profiles!support_messages_author_id_fkey(username)')
      .in('ticket_id', ticketIds)
      .order('created_at', { ascending: true });
    for (const m of (msgs ?? []) as unknown as {
      id: string;
      ticket_id: string;
      body: string;
      author_id: string;
      created_at: string;
      profiles: { username: string } | null;
    }[]) {
      const list = msgMap.get(m.ticket_id) ?? [];
      list.push({ id: m.id, body: m.body, author_id: m.author_id, created_at: m.created_at });
      msgMap.set(m.ticket_id, list);
    }
  }

  return (
    <div className="container py-8" dir="rtl">
      <PageHeader icon={LifeBuoy} title="تذاكر الدعم" desc="محادثات المستخدمين — ردّ عليها أو أغلقها بعد الحل." />

      {sp.error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
          <CardContent className="p-3 text-sm text-red-700 dark:text-red-300">{sp.error}</CardContent>
        </Card>
      )}

      {!ticketRows.length ? (
        <EmptyState title="لا توجد تذاكر دعم" hint="ستظهر هنا تذاكر المستخدمين فور فتحها من صفحة الدعم." />
      ) : (
        ticketRows.map((t) => (
          <Card key={t.id} className="mb-4">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {t.subject}
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{STATUS_AR[t.status] ?? t.status}</span>
                {t.profiles && (
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    @{t.profiles.username}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                فُتحت {new Date(t.created_at).toLocaleDateString('ar-EG')} · آخر تحديث{' '}
                {new Date(t.updated_at).toLocaleDateString('ar-EG')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3 dark:border-slate-700">
                {!(msgMap.get(t.id) ?? []).length ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">لا رسائل في هذه التذكرة بعد.</p>
                ) : (
                  (msgMap.get(t.id) ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        m.author_id === t.user_id
                          ? 'mr-8 bg-card dark:bg-slate-900'
                          : 'ml-8 border bg-primary/5'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString('ar-EG')}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <form action={reply.bind(null, t.id)} className="flex flex-wrap gap-2">
                <Input name="body" required placeholder="اكتب ردك للمستخدم…" className="max-w-md" />
                <Button size="sm" type="submit">
                  إرسال الرد
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {['resolved', 'closed', 'open'].map((s) => (
                  <form key={s} action={setStatus.bind(null, t.id, s)}>
                    <Button size="sm" variant="outline" type="submit">
                      {s === 'resolved' ? 'تم الحل' : s === 'closed' ? 'إغلاق التذكرة' : 'إعادة فتح'}
                    </Button>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
