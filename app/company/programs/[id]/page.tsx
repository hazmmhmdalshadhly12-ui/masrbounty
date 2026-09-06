import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

async function updateStatus(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const status = String(formData.get('status'));
  const { data: program } = await supabase.from('programs').select('name').eq('id', id).single();
  await supabase.from('programs').update({ status }).eq('id', id);
  // Notify researchers who saved this program
  const { data: savers } = await supabase
    .from('saved_programs')
    .select('researcher_id,researcher_profiles!inner(user_id)')
    .eq('program_id', id);
  for (const s of (savers ?? []) as unknown as { researcher_profiles: { user_id: string } }[]) {
    await notify(supabase, s.researcher_profiles.user_id, {
      type: 'program',
      title: `تحديث البرنامج ${program?.name ?? ''}: ${status}`,
      link: `/programs`,
    });
  }
  revalidatePath('/company/programs');
}

async function addAsset(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  await supabase.from('program_assets').insert({ program_id: id, type: String(formData.get('type')), value: String(formData.get('value')) });
  revalidatePath(`/company/programs/${id}`);
}

async function addRule(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  await supabase.from('program_rules').insert({ program_id: id, title: String(formData.get('title')), content: String(formData.get('content')) });
  revalidatePath(`/company/programs/${id}`);
}

async function saveBounty(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const severity = String(formData.get('severity'));
  const min = Number(formData.get('min_amount'));
  const max = Number(formData.get('max_amount'));
  if (!severity || !(min >= 0) || !(max >= min)) throw new Error('Invalid bounty range');
  await supabase
    .from('bounty_policies')
    .upsert({ program_id: id, severity, min_amount: min, max_amount: max }, { onConflict: 'program_id,severity' });
  revalidatePath(`/company/programs/${id}`);
}

async function deleteRule(ruleId: string, programId: string) {
  'use server';
  const supabase = await createServerClient();
  await supabase.from('program_rules').delete().eq('id', ruleId);
  revalidatePath(`/company/programs/${programId}`);
}

async function deleteAsset(assetId: string, programId: string) {
  'use server';
  const supabase = await createServerClient();
  await supabase.from('program_assets').delete().eq('id', assetId);
  revalidatePath(`/company/programs/${programId}`);
}

async function publishUpdate(programId: string, formData: FormData) {
  'use server';
  const { notify } = await import('@/lib/notify');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const body = String(formData.get('body') ?? '').trim();
  if (!title || !body) throw new Error('Title and body required');
  const { data: program } = await supabase.from('programs').select('name').eq('id', programId).single();
  await supabase.from('program_updates').insert({ program_id: programId, title, body, created_by: user.user.id });
  const { data: savers } = await supabase
    .from('saved_programs')
    .select('researcher_profiles!inner(user_id)')
    .eq('program_id', programId);
  for (const s of (savers ?? []) as unknown as { researcher_profiles: { user_id: string } }[]) {
    await notify(supabase, s.researcher_profiles.user_id, {
      type: 'program',
      title: `تحديث جديد في ${program?.name ?? 'برنامج'}: ${title}`,
      body: body.slice(0, 140),
      link: `/programs`,
    });
  }
  revalidatePath(`/company/programs/${programId}`);
}

async function inviteResearcher(programId: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const username = String(formData.get('username') ?? '').trim().replace(/^@/, '');
  if (!username) throw new Error('Username required');
  const { data: profile } = await supabase.from('profiles').select('id').eq('username', username).single();
  if (!profile) throw new Error('User not found');
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', profile.id).single();
  if (!rp) throw new Error('Not a researcher');
  await supabase.from('program_researchers').upsert({ program_id: programId, researcher_id: rp.id }, { onConflict: 'program_id,researcher_id' });
  revalidatePath(`/company/programs/${programId}`);
}

export default async function ManageProgram({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { id: programId } = await params;
  const { data: program } = await supabase.from('programs').select('*').eq('id', programId).single();
  if (!program) return <main className="container py-12">Not found.</main>;
  const [{ data: assets }, { data: rules }, { data: bounty }, { data: invited }, { data: updates }] = await Promise.all([
    supabase.from('program_assets').select('*').eq('program_id', programId),
    supabase.from('program_rules').select('*').eq('program_id', programId),
    supabase.from('bounty_policies').select('*').eq('program_id', programId),
    supabase.from('program_researchers').select('researcher_id,researcher_profiles(display_name)').eq('program_id', programId),
    supabase.from('program_updates').select('id,title,body,created_at').eq('program_id', programId).order('created_at', { ascending: false }).limit(10),
  ]);
  return (
    <main className="container py-8 max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-bold">{program.name}</h1><Badge className="mt-2">{program.status}</Badge>
        <form action={updateStatus.bind(null, program.id)} className="flex gap-2 mt-3">
          <select name="status" defaultValue={program.status} className="h-10 border rounded-md px-3">
            <option value="draft">draft</option><option value="pending_review">pending_review</option><option value="active">active</option><option value="paused">paused</option><option value="closed">closed</option>
          </select>
          <Button size="sm" type="submit">Update</Button>
        </form>
      </div>
      <Card><CardHeader><CardTitle>الأصول ({assets?.length ?? 0})</CardTitle></CardHeader><CardContent>
        {assets?.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b py-2 text-sm">
            <span>{a.type}: <span dir="ltr">{a.value}</span></span>
            <form action={deleteAsset.bind(null, a.id, program.id)}><Button size="sm" variant="ghost" type="submit">حذف</Button></form>
          </div>
        ))}
        <form action={addAsset.bind(null, program.id)} className="flex gap-2 mt-3">
          <select name="type" className="h-10 border rounded-md px-2"><option value="web">web</option><option value="api">api</option><option value="mobile">mobile</option><option value="network">network</option><option value="other">other</option></select>
          <Input name="value" required placeholder="https://… or 192.0.2.0/24" dir="ltr" />
          <Button size="sm" type="submit">إضافة</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>القواعد ({rules?.length ?? 0})</CardTitle></CardHeader><CardContent>
        {rules?.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b py-2 text-sm">
            <span><b>{r.title}:</b> {r.content}</span>
            <form action={deleteRule.bind(null, r.id, program.id)}><Button size="sm" variant="ghost" type="submit">حذف</Button></form>
          </div>
        ))}
        <form action={addRule.bind(null, program.id)} className="flex gap-2 mt-3">
          <Input name="title" required placeholder="العنوان" />
          <Input name="content" required placeholder="المحتوى" />
          <Button size="sm" type="submit">إضافة</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>باحثون مدعوون (للبرامج الخاصة)</CardTitle></CardHeader><CardContent>
        {((invited ?? []) as unknown as { researcher_id: string; researcher_profiles: { display_name: string } | null }[]).map((i) => (
          <p key={i.researcher_id} className="border-b py-1 text-sm">{i.researcher_profiles?.display_name}</p>
        ))}
        <form action={inviteResearcher.bind(null, program.id)} className="mt-3 flex gap-2">
          <Input name="username" required placeholder="username الباحث" dir="ltr" />
          <Button size="sm" type="submit">دعوة</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>تحديثات البرنامج</CardTitle></CardHeader><CardContent>
        {(updates ?? []).map((u: { id: string; title: string; body: string; created_at: string }) => (
          <div key={u.id} className="mb-3 border-b pb-3 last:border-0">
            <p className="text-sm font-bold">{u.title} <span className="font-normal text-muted-foreground">{new Date(u.created_at).toLocaleDateString('ar-EG')}</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{u.body}</p>
          </div>
        ))}
        <form action={publishUpdate.bind(null, program.id)} className="mt-3 space-y-2">
          <Input name="title" required maxLength={120} placeholder="عنوان التحديث" />
          <Textarea name="body" required placeholder="تفاصيل التحديث — يصل إشعار لحافظي البرنامج" />
          <Button size="sm" type="submit">نشر التحديث</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>سياسات المكافآت (EGP)</CardTitle></CardHeader><CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {(bounty ?? []).map((b) => (
            <p key={b.id} className="rounded-md border p-2 text-sm"><b>{b.severity}</b>: {b.min_amount} – {b.max_amount}</p>
          ))}
        </div>
        <form action={saveBounty.bind(null, program.id)} className="mt-3 flex flex-wrap gap-2">
          <select name="severity" className="h-10 border rounded-md px-2">
            <option value="informational">informational</option><option value="low">low</option>
            <option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option>
          </select>
          <Input name="min_amount" type="number" min={0} required placeholder="من" className="w-28" dir="ltr" />
          <Input name="max_amount" type="number" min={0} required placeholder="إلى" className="w-28" dir="ltr" />
          <Button size="sm" type="submit">حفظ النطاق</Button>
        </form>
      </CardContent></Card>
    </main>
  );
}
