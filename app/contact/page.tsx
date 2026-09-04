import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/layout/page-hero';

async function openTicket(formData: FormData) {
  'use server';
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (subject.length < 5 || body.length < 10) redirect('/contact?error=' + encodeURIComponent('اكتب موضوعًا وتفاصيل كافية'));
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login?error=' + encodeURIComponent('سجّل الدخول أولًا لفتح تذكرة دعم'));
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({ user_id: user.user.id, subject })
    .select('id')
    .single();
  if (error || !ticket) redirect('/contact?error=' + encodeURIComponent('تعذر فتح التذكرة — حاول لاحقًا'));
  await supabase.from('support_messages').insert({ ticket_id: ticket.id, author_id: user.user.id, body });
  revalidatePath('/contact');
  redirect('/contact?ok=' + encodeURIComponent('استلمنا تذكرتك — سنرد عليك قريبًا'));
}

export default async function Contact({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  return (
    <main>
      <PageHero kicker="نسمعك" title="تواصل معنا" desc="دعم فني، استفسارات شركات، أو بلاغ عن إساءة استخدام — نفتح لك تذكرة يتابعها فريقنا." />
      <section className="container max-w-2xl py-10">
        <Card>
          <CardHeader><CardTitle>فتح تذكرة دعم</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {ok && <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{ok}</p>}
            <form action={openTicket} className="space-y-4">
              <div>
                <Label htmlFor="subject">الموضوع</Label>
                <Input id="subject" name="subject" required minLength={5} placeholder="مثال: مشكلة في سحب الأرباح" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="body">التفاصيل</Label>
                <Textarea id="body" name="body" required minLength={10} rows={5} placeholder="اشرح المشكلة بالتفصيل…" className="mt-1" />
              </div>
              <Button type="submit" className="w-full bg-slate-900 font-bold text-white hover:bg-slate-700">
                إرسال التذكرة
              </Button>
            </form>
            <p className="mt-4 text-xs text-muted-foreground">
              للثغرات الأمنية في المنصة نفسها: راجع <a href="/security" className="underline">سياسة الإفصاح المسؤول</a> — لا تفتح تذكرة عامة.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
