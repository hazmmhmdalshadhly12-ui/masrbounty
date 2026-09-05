import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/shared/status-pill';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const MAX = 5 * 1024 * 1024;

async function researcher() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login');
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) redirect('/dashboard');
  return { supabase, user: user.user, researcherId: rp.id as string };
}

async function requestPhone(formData: FormData) {
  'use server';
  const { supabase, researcherId, user } = await researcher();
  const phone = String(formData.get('phone') ?? '').trim().replace(/[\s-]/g, '');
  if (!/^\+?[0-9]{8,15}$/.test(phone)) throw new Error('Invalid phone');
  await supabase.from('researcher_verifications').upsert(
    { researcher_id: researcherId, kind: 'phone', status: 'pending' },
    { onConflict: 'researcher_id,kind' }
  );
  await logAudit('create', 'researcher_verifications', researcherId, { kind: 'phone', phone }, user.id);
  revalidatePath('/dashboard/verification');
}

async function uploadIdentity(formData: FormData) {
  'use server';
  const { supabase, researcherId, user } = await researcher();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('No file');
  if (file.size > MAX) throw new Error('Max 5MB');
  if (!ALLOWED.has(file.type)) throw new Error('PNG/JPG/PDF only');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const path = `${researcherId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from('identity-documents').upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error(upErr.message);
  await supabase.from('researcher_verifications').upsert(
    { researcher_id: researcherId, kind: 'identity', status: 'pending' },
    { onConflict: 'researcher_id,kind' }
  );
  await supabase.from('kyc_reviews').insert({ researcher_id: researcherId, document_path: path, status: 'pending' });
  await logAudit('create', 'kyc_reviews', researcherId, { path }, user.id);
  revalidatePath('/dashboard/verification');
}

function Row({ label, state, hint }: { label: string; state: 'verified' | 'pending' | 'rejected' | 'missing'; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b py-3 text-sm last:border-0">
      <div>
        <p className="font-bold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {state === 'verified' ? <Badge>موثق</Badge> : state === 'pending' ? <StatusPill value="pending" /> : state === 'rejected' ? <Badge variant="destructive">مرفوض</Badge> : <Badge variant="secondary">غير موثق</Badge>}
    </div>
  );
}

export default async function VerificationPage() {
  const { supabase, user, researcherId } = await researcher();
  const [{ data: verifs }, { data: factors }, { data: kyc }] = await Promise.all([
    supabase.from('researcher_verifications').select('kind,status,verified_at,expires_at').eq('researcher_id', researcherId),
    supabase.auth.mfa.listFactors(),
    supabase.from('kyc_reviews').select('status,created_at').eq('researcher_id', researcherId).order('created_at', { ascending: false }).limit(1),
  ]);
  const get = (kind: string) => verifs?.find((v) => v.kind === kind)?.status ?? 'missing';
  const emailState = user.email_confirmed_at ? 'verified' : 'missing';
  const mfaOn = (factors?.totp?.length ?? 0) > 0;

  return (
    <div className="py-2">
      <h1 className="text-xl font-black tracking-tight">التحقق والثقة</h1>
      <p className="mt-1 text-sm text-muted-foreground">مستويات الثقة تُبنى تدريجيًا: بريد ← هاتف ← هوية ← باحث جدير بالثقة.</p>

      <Card className="mt-5">
        <CardHeader><CardTitle>حالة التحقق</CardTitle></CardHeader>
        <CardContent>
          <Row label="البريد الإلكتروني" state={emailState as 'verified' | 'missing'} hint={emailState === 'verified' ? 'مؤكد عبر رابط التفعيل' : 'أكّد بريدك من رابط التفعيل المرسل إليك'} />
          <Row label="الهاتف" state={get('phone') as 'pending' | 'verified' | 'rejected' | 'missing'} hint="مراجعة يدوية بعد تقديم الرقم" />
          <Row label="الهوية (KYC)" state={get('identity') as 'pending' | 'verified' | 'rejected' | 'missing'} hint={kyc?.[0] ? `آخر مراجعة: ${kyc[0].status}` : 'مستند هوية عند الحاجة للسحب'} />
          <Row label="المصادقة الثنائية" state={mfaOn ? 'verified' : 'missing'} hint="فعّلها من الإعدادات" />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>توثيق رقم الهاتف</CardTitle></CardHeader>
          <CardContent>
            <form action={requestPhone} className="flex gap-2">
              <Input name="phone" required placeholder="+2010…" dir="ltr" />
              <Button size="sm" type="submit">طلب توثيق</Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">نراجع الرقم يدويًا؛ لا يُعرض للعامة أبدًا.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>مستند الهوية (KYC)</CardTitle></CardHeader>
          <CardContent>
            <form action={uploadIdentity} className="flex gap-2">
              <Input type="file" name="file" required accept=".png,.jpg,.jpeg,.pdf" className="text-xs" />
              <Button size="sm" type="submit">رفع</Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">تخزين خاص مشفر، يطّلع عليه المراجع فقط وبأقل قدر لازم. حد أقصى 5MB.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
