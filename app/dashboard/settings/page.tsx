import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/services/audit';
import { logoutAction } from '@/features/auth/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MfaPanel } from '@/components/forms/mfa-panel';
import { ApiKeysCard } from '@/components/settings/api-keys-card';

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

async function changePassword(formData: FormData) {
  'use server';
  const current = String(formData.get('current') ?? '');
  const nextPw = String(formData.get('next') ?? '');
  if (nextPw.length < 8) throw new Error('كلمة السر 8 أحرف على الأقل');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user?.email) throw new Error('Unauthorized');
  // Re-authenticate with current password before allowing the change
  const { error: reauth } = await supabase.auth.signInWithPassword({ email: user.user.email, password: current });
  if (reauth) throw new Error('كلمة السر الحالية غير صحيحة');
  const { error } = await supabase.auth.updateUser({ password: nextPw });
  if (error) throw new Error('تعذر تغيير كلمة السر');
  revalidatePath('/dashboard/settings');
}

async function savePrefs(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('notification_preferences').upsert({
    user_id: user.user.id,
    email_reports: formData.get('email_reports') === 'on',
    email_bounty: formData.get('email_bounty') === 'on',
    email_messages: formData.get('email_messages') === 'on',
    email_program: formData.get('email_program') === 'on',
  }, { onConflict: 'user_id' });
  revalidatePath('/dashboard/settings');
}

async function logoutEverywhere() {
  'use server';
  const supabase = await createServerClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/');
}

async function deleteAccount(formData: FormData) {
  'use server';
  const confirm = String(formData.get('confirm') ?? '').trim();
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.user.id).single();
  if (!profile || confirm !== profile.username) throw new Error('اكتب اسم المستخدم للتأكيد');
  await logAudit('delete', 'profiles', user.user.id, { username: profile.username }, user.user.id);
  const admin = createAdminClient();
  await admin.from('profiles').delete().eq('id', user.user.id);
  const { error } = await admin.auth.admin.deleteUser(user.user.id);
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
  redirect('/?deleted=1');
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
  const { data: keys } = await supabase.from('api_keys').select('id,name,key_prefix,is_active,created_at').eq('user_id', user.user.id).order('created_at', { ascending: false });
  const { data: prefs } = await supabase.from('notification_preferences').select('*').eq('user_id', user.user.id).single();
  const ua = (await headers()).get('user-agent') ?? '—';
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
      <Card><CardHeader><CardTitle>الأمان</CardTitle></CardHeader><CardContent className="space-y-6">
        <form action={changePassword} className="space-y-3">
          <p className="text-sm font-bold">تغيير كلمة السر</p>
          <div><Label>الحالية</Label><Input name="current" type="password" required dir="ltr" /></div>
          <div><Label>الجديدة (8+ أحرف)</Label><Input name="next" type="password" required minLength={8} dir="ltr" /></div>
          <Button type="submit" size="sm">تغيير</Button>
        </form>
        <div className="border-t pt-4 text-sm">
          <p className="font-bold">الجلسة الحالية</p>
          <p className="mt-1 text-muted-foreground" dir="ltr">{user.user.email}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground" dir="ltr">{ua}</p>
          <p className="mt-1 text-xs text-muted-foreground">آخر دخول: {user.user.last_sign_in_at ? new Date(user.user.last_sign_in_at).toLocaleString('ar-EG') : '—'}</p>
          <div className="mt-3 flex gap-2">
            <form action={logoutAction}><Button size="sm" variant="outline" type="submit">تسجيل الخروج</Button></form>
            <form action={logoutEverywhere}><Button size="sm" variant="outline" type="submit">الخروج من كل الأجهزة</Button></form>
          </div>
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>المصادقة الثنائية (2FA)</CardTitle></CardHeader><CardContent>
        <MfaPanel />
      </CardContent></Card>
      <Card><CardHeader><CardTitle>تفضيلات الإشعارات</CardTitle></CardHeader><CardContent>
        <form action={savePrefs} className="grid gap-2 text-sm sm:grid-cols-2">
          {([
            ['email_reports', 'تقاريري'],
            ['email_bounty', 'المكافآت'],
            ['email_messages', 'الرسائل'],
            ['email_program', 'البرامج'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-md border p-2">
              <input type="checkbox" name={key} defaultChecked={prefs ? (prefs[key] as boolean) ?? true : true} className="h-4 w-4" />
              إشعارات {label}
            </label>
          ))}
          <div className="sm:col-span-2"><Button size="sm" type="submit">حفظ التفضيلات</Button></div>
        </form>
      </CardContent></Card>
      <ApiKeysCard initial={(keys ?? []) as { id: string; name: string; key_prefix: string; is_active: boolean; created_at: string }[]} />
      <Card className="border-red-200"><CardHeader><CardTitle className="text-red-700">منطقة الخطر</CardTitle></CardHeader><CardContent>
        <form action={deleteAccount} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label>اكتب اسم المستخدم <b dir="ltr">{profile?.username}</b> للتأكيد النهائي</Label>
            <Input name="confirm" required dir="ltr" placeholder={profile?.username ?? ''} className="mt-1" />
          </div>
          <Button type="submit" variant="destructive" size="sm">حذف الحساب نهائيًا</Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">يحذف الحساب وملفك وجميع بياناتك المرتبطة. لا يمكن التراجع.</p>
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
