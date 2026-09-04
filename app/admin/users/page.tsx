import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function setActive(userId: string, active: boolean, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Unauthorized');
  if (me.user.id === userId) throw new Error('Cannot change your own status');
  const reason = String(formData.get(`reason_${userId}`) ?? '');
  await supabase.from('profiles').update({ is_active: active }).eq('id', userId);
  await supabase.from('moderation_actions').insert({
    moderator_id: me.user.id,
    target_type: 'user',
    target_id: userId,
    action: active ? 'unban' : 'ban',
    reason: reason || null,
  });
  await logAudit('moderate', 'profiles', userId, { active, reason }, me.user.id);
  revalidatePath('/admin/users');
}

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const supabase = await createServerClient();
  let query = supabase.from('profiles').select('id,username,full_name,is_active,created_at').order('created_at', { ascending: false }).limit(100);
  if (q.trim()) query = query.ilike('username', `%${q.trim()}%`);
  const { data: users } = await query;
  return (
    <div className="py-2">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight">المستخدمون ({users?.length ?? 0})</h1>
        <form className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="بحث بالاسم…" className="h-9 w-48" />
          <Button size="sm" variant="outline" type="submit">بحث</Button>
        </form>
      </div>
      {!users?.length ? <p className="text-sm text-muted-foreground">No users (RLS may restrict — admin only).</p> :
        users.map((u) => (
          <Card key={u.id} className="mb-2">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="text-sm font-bold" dir="ltr">{u.username}</span>
              <span className="flex items-center gap-2">
                {u.is_active ? <Badge>نشط</Badge> : <Badge variant="destructive">موقوف</Badge>}
                <form action={setActive.bind(null, u.id, !u.is_active)} className="flex gap-2">
                  <Input name={`reason_${u.id}`} placeholder="السبب" className="h-8 w-36" />
                  <Button size="sm" variant={u.is_active ? 'destructive' : 'default'} type="submit">
                    {u.is_active ? 'إيقاف' : 'تفعيل'}
                  </Button>
                </form>
              </span>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
