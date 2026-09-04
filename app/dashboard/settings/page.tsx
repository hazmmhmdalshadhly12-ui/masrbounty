import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

async function updateProfile(formData: FormData) {
  'use server';
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('profiles').update({
    full_name: String(formData.get('full_name') ?? ''),
    bio: String(formData.get('bio') ?? ''),
    locale: String(formData.get('locale') ?? 'ar'),
  }).eq('id', user.user.id);
  revalidatePath('/dashboard/settings');
}

async function addMethod(formData: FormData) {
  'use server';
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) throw new Error('No researcher profile');
  const { error } = await supabase.from('payment_methods').insert({
    researcher_id: rp.id,
    type: String(formData.get('type') ?? 'bank'),
    label: String(formData.get('label') ?? ''),
    details: { account: String(formData.get('account') ?? '') },
  });
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/settings');
}

export default async function SettingsPage() {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.user.id).single();
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  const { data: methods } = rp ? await supabase.from('payment_methods').select('*').eq('researcher_id', rp.id) : { data: [] };
  return (
    <main className="container py-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent>
        <form action={updateProfile} className="space-y-3">
          <div><Label>Full name</Label><Input name="full_name" defaultValue={profile?.full_name ?? ''} /></div>
          <div><Label>Bio</Label><Input name="bio" defaultValue={profile?.bio ?? ''} /></div>
          <div><Label>Locale</Label><select name="locale" defaultValue={profile?.locale ?? 'ar'} className="h-10 border rounded-md px-3 w-full"><option value="ar">العربية</option><option value="en">English</option></select></div>
          <Button type="submit">Save</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Payment methods</CardTitle></CardHeader><CardContent className="space-y-3">
        {methods?.map((m) => <p key={m.id} className="text-sm border rounded p-2">{m.label} ({m.type})</p>)}
        <form action={addMethod} className="flex gap-2">
          <select name="type" className="h-10 border rounded-md px-2"><option value="bank">Bank</option><option value="wallet">Wallet</option><option value="other">Other</option></select>
          <Input name="label" required placeholder="Label" />
          <Input name="account" required placeholder="Account / IBAN" dir="ltr" />
          <Button type="submit">Add</Button>
        </form>
      </CardContent></Card>
    </main>
  );
}
