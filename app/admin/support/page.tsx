import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/admin-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

async function reply(ticketId: string, formData: FormData) {
  'use server';
  const { supabase, user } = await requireStaff(['admin', 'moderator']);
  await supabase.from('support_messages').insert({ ticket_id: ticketId, author_id: user.id, body: String(formData.get('body')) });
  await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', ticketId);
  revalidatePath('/admin/support');
}

export default async function Support() {
  const supabase = await createServerClient();
  const { data: tickets } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(50);
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">الدعم</h1>
      {!tickets?.length ? <p className="text-muted-foreground">No tickets.</p> : tickets.map((t) => (
        <Card key={t.id} className="mb-3"><CardHeader><CardTitle className="text-base">{t.subject} <Badge>{t.status}</Badge></CardTitle></CardHeader>
          <CardContent>
            <form action={reply.bind(null, t.id)} className="flex gap-2"><Input name="body" required placeholder="Reply…" /><Button size="sm" type="submit">Send</Button></form>
          </CardContent></Card>
      ))}
    </div>
  );
}
