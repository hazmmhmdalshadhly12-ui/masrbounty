import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MfaPanel } from '@/components/forms/mfa-panel';

async function updateProfile(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('profiles').update({
    full_name: String(formData.get('full_name') ?? ''),
    bio: String(formData.get('bio') ?? ''),
    locale: String(formData.get('locale') ?? 'ar'),
  }).eq('id', user.user.id);
  revalidatePath('/dashboard/settings');
}

async function updateResearcher(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const skills = String(formData.get('skills') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  await supabase
    .from('researcher_profiles')
    .update({
      display_name: String(formData.get('display_name') ?? '').slice(0, 80),
      website: String(formData.get('website') ?? '') || null,
      github: String(formData.get('github') ?? '') || null,
      twitter: String(formData.get('twitter') ?? '') || null,
      skills,
      is_public: formData.get('is_public') === 'on',
    })
    .eq('user_id', user.user.id);
  revalidatePath('/dashboard/settings');
}

async function addMethod(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
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
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.user.id).single();
  const { data: rp } = await supabase.from('researcher_profiles').select('*').eq('user_id', user.user.id).single();
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
      {rp && (
        <Card><CardHeader><CardTitle>الملف المهني (عام)</CardTitle></CardHeader><CardContent>
          <form action={updateResearcher} className="grid gap-3 sm:grid-cols-2">
            <div><Label>الاسم المعروض</Label><Input name="display_name" defaultValue={rp.display_name ?? ''} required /></div>
            <div><Label>المهارات (افصل بفاصلة)</Label><Input name="skills" defaultValue={(rp.skills ?? []).join(', ')} dir="ltr" placeholder="xss, sqli, idor" /></div>
            <div><Label>الموقع</Label><Input name="website" defaultValue={rp.website ?? ''} dir="ltr" placeholder="https://…" /></div>
            <div><Label>GitHub</Label><Input name="github" defaultValue={rp.github ?? ''} dir="ltr" placeholder="username" /></div>
            <div><Label>Twitter/X</Label><Input name="twitter" defaultValue={rp.twitter ?? ''} dir="ltr" placeholder="@handle" /></div>
            <div className="flex items-center gap-2 text-sm">
              <input type="checkbox" id="is_public" name="is_public" defaultChecked={rp.is_public ?? true} className="h-4 w-4" />
              <Label htmlFor="is_public">ملف عام (يظهر في الباحثين والمتصدرين)</Label>
            </div>
            <div className="sm:col-span-2"><Button type="submit">حفظ الملف المهني</Button></div>
          </form>
        </CardContent></Card>
      )}
      <Card><CardHeader><CardTitle>المصادقة الثنائية (2FA)</CardTitle></CardHeader><CardContent>
        <MfaPanel />
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
