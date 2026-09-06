import { createServerClient } from '@/lib/supabase/server';
import { sendMessageAction } from '@/features/messaging/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/avatar';
import { timeAgo } from '@/utils/time';

export default async function CompanyMessages({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-2 text-sm">سجّل الدخول أولًا.</div>;
  const { data: memberships } = await supabase.from('conversation_members').select('conversation_id,conversations(id,subject)').eq('user_id', user.user.id);
  const list = ((memberships ?? []) as unknown as { conversation_id: string; conversations: { subject: string | null } | null }[]);
  const activeId = c ?? list[0]?.conversation_id;
  const { data: messages } = activeId
    ? await supabase.from('messages').select('id,body,sender_id,created_at,profiles!inner(username)').eq('conversation_id', activeId).order('created_at').limit(100)
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
              {((messages ?? []) as unknown as { id: string; body: string; sender_id: string; created_at: string; profiles: { username: string } }[]).map((m) => (
                <div key={m.id} className={`flex gap-2 rounded border p-2 ${m.sender_id === user.user!.id ? 'bg-accent' : ''}`}>
                  <Avatar name={m.profiles.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground" dir="ltr">@{m.profiles.username}</span> · {timeAgo(m.created_at)}</p>
                    <p className="mt-0.5 text-sm">{m.body}</p>
                  </div>
                </div>
              ))}
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
