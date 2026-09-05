import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/layout/page-hero';

async function submitAppeal(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!email.includes('@') || reason.length < 10) {
    redirect('/appeal?error=' + encodeURIComponent('بريد غير صالح أو سبب قصير (10 أحرف على الأقل)'));
  }
  const db = createAdminClient();
  const { data: users } = await db.auth.admin.listUsers();
  const target = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!target) {
    redirect('/appeal?error=' + encodeURIComponent('لا يوجد حساب بهذا البريد'));
  }
  await db.from('appeals').insert({ user_id: target.id, target_type: 'user', target_id: target.id, reason });
  redirect('/appeal?ok=' + encodeURIComponent('استلمنا استئنافك — ستراجع الإدارة حالتك وترد عليك'));
}

export default async function Appeal({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  return (
    <main>
      <PageHero kicker="حق المراجعة" title="الاستئناف على الإيقاف" desc="أُوقف حسابك؟ اشرح موقفك وستعيد الإدارة النظر — كل استئناف موثق بقرار ومبرر." />
      <section className="container max-w-xl py-10">
        <Card>
          <CardHeader><CardTitle>نموذج الاستئناف</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {ok && <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{ok}</p>}
            <form action={submitAppeal} className="space-y-4">
              <div>
                <Label htmlFor="email">بريد الحساب الموقوف</Label>
                <Input id="email" name="email" type="email" required dir="ltr" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="reason">شرح الموقف (10+ أحرف)</Label>
                <Textarea id="reason" name="reason" required minLength={10} rows={5} className="mt-1" placeholder="اشرح لماذا تعتقد أن الإيقاف غير مستحق…" />
              </div>
              <Button type="submit" className="w-full bg-slate-900 font-bold text-white hover:bg-slate-700">إرسال الاستئناف</Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
