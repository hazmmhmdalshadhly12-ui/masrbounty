import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

async function invite(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const companyId = String(formData.get('company_id'));
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'viewer');
  if (!email.includes('@')) throw new Error('بريد غير صالح');
  if (!['viewer', 'triager', 'admin'].includes(role)) throw new Error('دور غير صالح');
  // Only owners and admins may invite (never triagers/viewers, never other companies)
  const { data: company } = await supabase.from('company_profiles').select('owner_id').eq('id', companyId).single();
  const { data: mine } = await supabase.from('company_members').select('role').eq('company_id', companyId).eq('user_id', user.user.id).single();
  const myRole = company?.owner_id === user.user.id ? 'owner' : (mine as { role: string } | null)?.role;
  if (myRole !== 'owner' && myRole !== 'admin') throw new Error('الدعوات للمؤسس والمدراء فقط');
  const { error } = await supabase.from('company_invitations').insert({ company_id: companyId, email, role });
  if (error) throw new Error('تعذر إرسال الدعوة');
  revalidatePath('/company/team');
}

export default async function TeamPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: companies } = await supabase.from('company_profiles').select('id,name').eq('owner_id', user.user.id);
  const companyId = companies?.[0]?.id;
  const [{ data: members }, { data: invites }] = companyId ? await Promise.all([
    supabase.from('company_members').select('id,role,user_id').eq('company_id', companyId),
    supabase.from('company_invitations').select('id,email,role,accepted_at').eq('company_id', companyId),
  ]) : { data: null, invites: null } as never;
  return (
    <main className="container py-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">الفريق</h1>
      {!companyId ? <p className="text-muted-foreground">Create a company first.</p> : (
        <>
          <Card><CardHeader><CardTitle>Members ({members?.length ?? 0})</CardTitle></CardHeader>
            <CardContent>{members?.map((m: { id: string; role: string }) => <p key={m.id} className="text-sm border-b py-1">{m.role}</p>)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Invite</CardTitle></CardHeader><CardContent>
            <form action={invite} className="flex gap-2">
              <input type="hidden" name="company_id" value={companyId} />
              <Input name="email" type="email" required placeholder="email" dir="ltr" />
              <select name="role" className="h-10 border rounded-md px-2"><option value="viewer">viewer</option><option value="triager">triager</option><option value="admin">admin</option></select>
              <Button type="submit">Invite</Button>
            </form>
            {invites?.map((i: { id: string; email: string; role: string }) => <p key={i.id} className="text-sm mt-2">{i.email} — {i.role}</p>)}
          </CardContent></Card>
        </>
      )}
    </main>
  );
}
