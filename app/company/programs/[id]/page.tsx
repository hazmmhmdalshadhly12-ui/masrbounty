import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

async function updateStatus(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  await supabase.from('programs').update({ status: String(formData.get('status')) }).eq('id', id);
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

export default async function ManageProgram({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { id: programId } = await params;
  const { data: program } = await supabase.from('programs').select('*').eq('id', programId).single();
  if (!program) return <main className="container py-12">Not found.</main>;
  const [{ data: assets }, { data: rules }, { data: bounty }] = await Promise.all([
    supabase.from('program_assets').select('*').eq('program_id', programId),
    supabase.from('program_rules').select('*').eq('program_id', programId),
    supabase.from('bounty_policies').select('*').eq('program_id', programId),
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
      <Card><CardHeader><CardTitle>Assets</CardTitle></CardHeader><CardContent>
        {assets?.map((a) => <p key={a.id} className="text-sm border-b py-1">{a.type}: <span dir="ltr">{a.value}</span></p>)}
        <form action={addAsset.bind(null, program.id)} className="flex gap-2 mt-3">
          <select name="type" className="h-10 border rounded-md px-2"><option value="web">web</option><option value="api">api</option><option value="mobile">mobile</option><option value="network">network</option><option value="other">other</option></select>
          <Input name="value" required placeholder="https://… or 192.0.2.0/24" dir="ltr" />
          <Button size="sm" type="submit">Add</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Rules</CardTitle></CardHeader><CardContent>
        {rules?.map((r) => <p key={r.id} className="text-sm border-b py-1"><b>{r.title}:</b> {r.content}</p>)}
        <form action={addRule.bind(null, program.id)} className="flex gap-2 mt-3">
          <Input name="title" required placeholder="Title" />
          <Input name="content" required placeholder="Content" />
          <Button size="sm" type="submit">Add</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Bounty policies</CardTitle></CardHeader><CardContent>
        {!bounty?.length ? <p className="text-sm text-muted-foreground">None — add from Supabase or extend this form.</p> : bounty.map((b) => <p key={b.id} className="text-sm">{b.severity}: {b.min_amount}–{b.max_amount}</p>)}
      </CardContent></Card>
    </main>
  );
}
