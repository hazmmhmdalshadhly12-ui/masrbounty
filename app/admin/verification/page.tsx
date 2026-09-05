import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function staff() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  return { supabase, user: user.user };
}

async function decideResearcher(rowId: string, kind: string, researcherId: string, approve: boolean, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const note = String(formData.get(`note_${rowId}`) ?? '');
  await supabase.from('researcher_verifications').update({
    status: approve ? 'verified' : 'rejected',
    verified_at: approve ? new Date().toISOString() : null,
    reviewed_by: user.id,
    review_note: note || null,
  }).eq('id', rowId);
  if (approve && kind === 'identity') {
    const { data: badge } = await supabase.from('badges').select('id').eq('code', 'verified-researcher').single();
    if (badge) {
      await supabase.from('researcher_badges').upsert({ researcher_id: researcherId, badge_id: badge.id }, { onConflict: 'researcher_id,badge_id' });
    }
  }
  await logAudit('verify', 'researcher_verifications', rowId, { approve, kind }, user.id);
  revalidatePath('/admin/verification');
}

async function decideKyc(rowId: string, researcherId: string, approve: boolean, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const note = String(formData.get(`knote_${rowId}`) ?? '');
  await supabase.from('kyc_reviews').update({
    status: approve ? 'verified' : 'rejected', reviewed_by: user.id, review_note: note || null,
  }).eq('id', rowId);
  await supabase.from('researcher_verifications').upsert(
    { researcher_id: researcherId, kind: 'identity', status: approve ? 'verified' : 'rejected', verified_at: approve ? new Date().toISOString() : null, reviewed_by: user.id, review_note: note || null },
    { onConflict: 'researcher_id,kind' }
  );
  if (approve) {
    const { data: badge } = await supabase.from('badges').select('id').eq('code', 'verified-researcher').single();
    if (badge) {
      await supabase.from('researcher_badges').upsert({ researcher_id: researcherId, badge_id: badge.id }, { onConflict: 'researcher_id,badge_id' });
    }
  }
  await logAudit('verify', 'kyc_reviews', rowId, { approve }, user.id);
  revalidatePath('/admin/verification');
}

async function decideAppeal(appealId: string, accept: boolean, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const resolution = String(formData.get(`ares_${appealId}`) ?? '');
  await supabase.from('appeals').update({
    status: accept ? 'accepted' : 'rejected', reviewed_by: user.id, resolution: resolution || null,
  }).eq('id', appealId);
  if (accept) {
    const { data: appeal } = await supabase.from('appeals').select('target_type,target_id').eq('id', appealId).single();
    if (appeal?.target_type === 'user' && appeal.target_id) {
      await supabase.from('profiles').update({ is_active: true }).eq('id', appeal.target_id);
    }
  }
  await logAudit('moderate', 'appeals', appealId, { accept }, user.id);
  revalidatePath('/admin/verification');
}

async function reviewSuspicious(eventId: string, dismiss: boolean) {
  'use server';
  const { supabase, user } = await staff();
  await supabase.from('suspicious_events').update({ status: dismiss ? 'dismissed' : 'reviewed' }).eq('id', eventId);
  await logAudit('moderate', 'suspicious_events', eventId, { dismiss }, user.id);
  revalidatePath('/admin/verification');
}

type RV = { id: string; kind: string; status: string; created_at: string; researcher_profiles: { display_name: string } | null };

export default async function VerificationCenter() {
  const supabase = await createServerClient();
  const [{ data: rv }, { data: kyc }, { data: domains }, { data: susp }, { data: appeals }] = await Promise.all([
    supabase.from('researcher_verifications').select('id,kind,status,researcher_id,created_at,researcher_profiles(display_name)').eq('status', 'pending').order('created_at').limit(50),
    supabase.from('kyc_reviews').select('id,researcher_id,status,document_path,created_at').eq('status', 'pending').order('created_at').limit(50),
    supabase.from('domain_verifications').select('id,domain,status,company_id').eq('status', 'failed').order('created_at', { ascending: false }).limit(20),
    supabase.from('suspicious_events').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
    supabase.from('appeals').select('*').eq('status', 'open').order('created_at').limit(50),
  ]);

  return (
    <div className="space-y-6 py-2">
      <h1 className="text-xl font-black tracking-tight">مركز التحقق</h1>

      <Card>
        <CardHeader><CardTitle>تحقق الباحثين المعلق ({rv?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!(rv ?? []).length ? <p className="text-sm text-muted-foreground">لا يوجد.</p> :
            ((rv ?? []) as unknown as (RV & { researcher_id: string })[]).map((r) => (
              <form key={r.id} className="mb-3 flex flex-wrap items-center gap-2 border-b pb-3 text-sm">
                <Badge>{r.kind}</Badge>
                <span className="font-bold">{r.researcher_profiles?.display_name}</span>
                <Input name={`note_${r.id}`} placeholder="سبب القرار" className="h-9 max-w-xs" />
                <Button size="sm" type="submit" formAction={decideResearcher.bind(null, r.id, r.kind, r.researcher_id, true)}>اعتماد</Button>
                <Button size="sm" variant="outline" type="submit" formAction={decideResearcher.bind(null, r.id, r.kind, r.researcher_id, false)}>رفض</Button>
              </form>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>مراجعات الهوية KYC ({kyc?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!(kyc ?? []).length ? <p className="text-sm text-muted-foreground">لا يوجد.</p> :
            kyc!.map((k: { id: string; researcher_id: string; document_path: string | null }) => (
              <form key={k.id} className="mb-3 flex flex-wrap items-center gap-2 border-b pb-3 text-sm">
                <span dir="ltr" className="font-mono text-xs">{k.document_path}</span>
                <Input name={`knote_${k.id}`} placeholder="ملاحظة" className="h-9 max-w-xs" />
                <Button size="sm" type="submit" formAction={decideKyc.bind(null, k.id, k.researcher_id, true)}>اعتماد + شارة</Button>
                <Button size="sm" variant="outline" type="submit" formAction={decideKyc.bind(null, k.id, k.researcher_id, false)}>رفض</Button>
              </form>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>نطاقات فشل تحققها ({domains?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!(domains ?? []).length ? <p className="text-sm text-muted-foreground">لا يوجد.</p> :
            domains!.map((d: { id: string; domain: string }) => (
              <p key={d.id} className="border-b py-2 text-sm last:border-0" dir="ltr">{d.domain} — failed</p>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>حسابات مشبوهة ({susp?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!(susp ?? []).length ? <p className="text-sm text-muted-foreground">لا يوجد.</p> :
            susp!.map((s: { id: string; kind: string; detail: string | null; severity: string }) => (
              <form key={s.id} className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2 text-sm">
                <Badge variant={s.severity === 'high' ? 'destructive' : 'secondary'}>{s.severity}</Badge>
                <span className="font-bold" dir="ltr">{s.kind}</span>
                <span className="text-muted-foreground">{s.detail}</span>
                <Button size="sm" variant="outline" type="submit" formAction={reviewSuspicious.bind(null, s.id, false)}>رُوجعت</Button>
                <Button size="sm" variant="ghost" type="submit" formAction={reviewSuspicious.bind(null, s.id, true)}>تجاهل</Button>
              </form>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الاستئنافات ({appeals?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!(appeals ?? []).length ? <p className="text-sm text-muted-foreground">لا يوجد.</p> :
            appeals!.map((a: { id: string; target_type: string; reason: string }) => (
              <form key={a.id} className="mb-3 border-b pb-3 text-sm">
                <p><b dir="ltr">{a.target_type}</b> — {a.reason}</p>
                <div className="mt-2 flex gap-2">
                  <Input name={`ares_${a.id}`} placeholder="حيثيات القرار" className="h-9 max-w-xs" />
                  <Button size="sm" type="submit" formAction={decideAppeal.bind(null, a.id, true)}>قبول (يفك الإيقاف)</Button>
                  <Button size="sm" variant="outline" type="submit" formAction={decideAppeal.bind(null, a.id, false)}>رفض</Button>
                </div>
              </form>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
