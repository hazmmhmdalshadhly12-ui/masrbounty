import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function AdminUsers() {
  const supabase = await createServerClient();
  const { data: roles } = await supabase.auth.getUser();
  void roles;
  const { data: users } = await supabase.from('profiles').select('id,username,full_name,is_active,created_at').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      {!users?.length ? <p className="text-muted-foreground">No users (RLS may restrict — admin only).</p> :
        users.map((u) => <Card key={u.id} className="mb-2"><CardContent className="p-3 flex justify-between"><span>{u.username}</span><span className="text-xs">{u.is_active ? 'active' : 'banned'}</span></CardContent></Card>)}
    </main>
  );
}
