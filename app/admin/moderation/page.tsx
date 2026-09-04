import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

async function moderate(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('moderation_actions').insert({
    moderator_id: user.user.id,
    target_type: String(formData.get('target_type')),
    target_id: String(formData.get('target_id')),
    action: String(formData.get('action')),
    reason: String(formData.get('reason') ?? ''),
  });
  revalidatePath('/admin/moderation');
}

export default async function Moderation() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('moderation_actions').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">الإشراف</h1>
      <Card><CardHeader><CardTitle>New action</CardTitle></CardHeader><CardContent>
        <form action={moderate} className="space-y-2">
          <div className="flex gap-2">
            <select name="target_type" className="h-10 border rounded-md px-2"><option value="report">report</option><option value="user">user</option><option value="program">program</option></select>
            <Input name="target_id" required placeholder="Target UUID" dir="ltr" />
            <Input name="action" required placeholder="warn / suspend / ban" />
          </div>
          <Input name="reason" required placeholder="Reason" />
          <Button type="submit">Record</Button>
        </form>
      </CardContent></Card>
      {data?.map((m) => <Card key={m.id}><CardContent className="p-3 text-sm">{m.target_type} — {m.action} — {m.reason}</CardContent></Card>)}
    </main>
  );
}
