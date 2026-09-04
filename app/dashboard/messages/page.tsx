import { createServerClient } from '@/lib/supabase/server';
import { sendMessageAction } from '@/features/messaging/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default async function MessagesPage({ searchParams }: { searchParams: { c?: string } }) {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: memberships } = await supabase.from('conversation_members').select('conversation_id,conversations(id,subject)').eq('user_id', user.user.id);
  const activeId = searchParams.c ?? (memberships?.[0]?.conversation_id as string | undefined);
  const { data: messages } = activeId
    ? await supabase.from('messages').select('id,body,sender_id,created_at').eq('conversation_id', activeId).order('created_at').limit(100)
    : { data: [] };
  if (activeId) {
    await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', activeId).eq('user_id', user.user.id);
  }
  return (
    <main className="container py-8 grid md:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle>Conversations</CardTitle></CardHeader><CardContent>
        {!memberships?.length ? <p className="text-sm text-muted-foreground">None yet.</p> :
          ((memberships ?? []) as unknown as { conversation_id: string; conversations: { subject: string | null } | null }[]).map((m) => (
            <a key={m.conversation_id} href={`/dashboard/messages?c=${m.conversation_id}`} className="block border rounded p-2 mb-2 text-sm hover:bg-accent">{m.conversations?.subject || m.conversation_id.slice(0, 8)}</a>
          ))}
      </CardContent></Card>
      <Card className="md:col-span-2"><CardHeader><CardTitle>Messages</CardTitle></CardHeader><CardContent className="space-y-2">
        {!activeId ? <p className="text-sm text-muted-foreground">Select a conversation.</p> : (
          <>
            {messages?.map((m) => <div key={m.id} className={`text-sm border rounded p-2 ${m.sender_id === user.user!.id ? 'bg-accent' : ''}`}>{m.body}</div>)}
            <form action={sendMessageAction} className="space-y-2 pt-2">
              <input type="hidden" name="conversation_id" value={activeId} />
              <Textarea name="body" required placeholder="Write a message…" />
              <Button size="sm" type="submit">Send</Button>
            </form>
          </>
        )}
      </CardContent></Card>
    </main>
  );
}
