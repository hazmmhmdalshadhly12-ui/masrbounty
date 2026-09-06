import { MessagesSquare } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { sendMessageAction } from '@/features/messaging/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/avatar';
import { timeAgo } from '@/utils/time';
import { PageHeader } from '@/components/shared/page-header';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: memberships } = await supabase.from('conversation_members').select('conversation_id,conversations(id,subject)').eq('user_id', user.user.id);
  const activeId = (await searchParams).c ?? (memberships?.[0]?.conversation_id as string | undefined);
  const { data: messages } = activeId
    ? await supabase.from('messages').select('id,body,sender_id,created_at,profiles!inner(username)').eq('conversation_id', activeId).order('created_at').limit(100)
    : { data: [] };
  if (activeId) {
    await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', activeId).eq('user_id', user.user.id);
  }
  return (
    <div className="py-2">
    <PageHeader icon={MessagesSquare} title="الرسائل" desc="محادثاتك مع فرق الشركات حول التقارير" />
    <main className="grid md:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle>Conversations</CardTitle></CardHeader><CardContent>
        {!memberships?.length ? <p className="text-sm text-muted-foreground">None yet.</p> :
          ((memberships ?? []) as unknown as { conversation_id: string; conversations: { subject: string | null } | null }[]).map((m) => (
            <a key={m.conversation_id} href={`/dashboard/messages?c=${m.conversation_id}`} className="block border rounded p-2 mb-2 text-sm hover:bg-accent">{m.conversations?.subject || m.conversation_id.slice(0, 8)}</a>
          ))}
      </CardContent></Card>
      <Card className="md:col-span-2"><CardHeader><CardTitle>Messages</CardTitle></CardHeader><CardContent className="space-y-2">
        {!activeId ? <p className="text-sm text-muted-foreground">Select a conversation.</p> : (
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
              <Textarea name="body" required placeholder="Write a message…" />
              <Button size="sm" type="submit">Send</Button>
            </form>
          </>
        )}
      </CardContent></Card>
    </main>
    </div>
  );
}
