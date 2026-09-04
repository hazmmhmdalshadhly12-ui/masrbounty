import { createServerClient } from '@/lib/supabase/server';
import { sendMessageAction } from '@/features/messaging/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default async function CompanyMessages({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-2 text-sm">سجّل الدخول أولًا.</div>;
  const { data: memberships } = await supabase.from('conversation_members').select('conversation_id,conversations(id,subject)').eq('user_id', user.user.id);
  const list = ((memberships ?? []) as unknown as { conversation_id: string; conversations: { subject: string | null } | null }[]);
  const activeId = c ?? list[0]?.conversation_id;
  const { data: messages } = activeId
    ? await supabase.from('messages').select('id,body,sender_id,created_at').eq('conversation_id', activeId).order('created_at').limit(100)
    : { data: [] };
  if (activeId) {
    await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', activeId).eq('user_id', user.user.id);
  }
  return (
    <div className="py-2">
      <h1 className="mb-5 text-xl font-black tracking-tight">الرسائل</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>المحادثات</CardTitle></CardHeader><CardContent>
          {!list.length ? <p className="text-sm text-muted-foreground">لا توجد محادثات — ابدأ واحدة من صفحة التقرير.</p> :
            list.map((m) => (
              <a key={m.conversation_id} href={`/company/messages?c=${m.conversation_id}`} className="mb-2 block rounded-md border p-2 text-sm hover:bg-accent">{m.conversations?.subject || m.conversation_id.slice(0, 8)}</a>
            ))}
        </CardContent></Card>
        <Card className="md:col-span-2"><CardHeader><CardTitle>الرسائل</CardTitle></CardHeader><CardContent className="space-y-2">
          {!activeId ? <p className="text-sm text-muted-foreground">اختر محادثة.</p> : (
            <>
              {messages?.map((m) => <div key={m.id} className={`rounded border p-2 text-sm ${m.sender_id === user.user!.id ? 'bg-accent' : ''}`}>{m.body}</div>)}
              <form action={sendMessageAction} className="space-y-2 pt-2">
                <input type="hidden" name="conversation_id" value={activeId} />
                <Textarea name="body" required placeholder="اكتب رسالة…" />
                <Button size="sm" type="submit">إرسال</Button>
              </form>
            </>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}
