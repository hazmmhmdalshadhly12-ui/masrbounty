import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { ShieldCheck, Globe, Copy, CheckCircle2, XCircle, Search, AlertTriangle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function staff() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  return { supabase, user: user.user };
}

// ---- Domain verification actions ----

async function verifyDomain(domainId: string, companyId: string, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const note = String(formData.get(`note_${domainId}`) ?? '').trim();
  await supabase
    .from('domain_verifications')
    .update({ status: 'verified', verified_at: new Date().toISOString(), last_checked_at: new Date().toISOString() })
    .eq('id', domainId);
  // notify company owner/members
  try {
    const admin = createAdminClient();
    const { data: company } = await admin.from('company_profiles').select('owner_id,name').eq('id', companyId).single();
    if (company) {
      await notify(supabase, (company as { owner_id: string }).owner_id, {
        type: 'system',
        title: `تم توثيق نطاق شركتكم ${company.name}`,
        body: note || 'تم التحقق بنجاح بواسطة الإدارة',
        link: '/company/domains',
      });
      const { data: members } = await admin.from('company_members').select('user_id').eq('company_id', companyId);
      for (const m of (members ?? []) as { user_id: string }[]) {
        if (m.user_id !== company.owner_id) {
          await notify(supabase, m.user_id, { type: 'system', title: `تم توثيق نطاق ${company.name}`, link: '/company/domains' });
        }
      }
    }
  } catch {
    /* ignore notify */
  }
  await supabase.from('moderation_actions').insert({
    moderator_id: user.id,
    target_type: 'domain',
    target_id: domainId,
    action: 'verify',
    reason: note || 'manual verify',
  });
  await logAudit('verify', 'domain_verifications', domainId, { status: 'verified', company_id: companyId }, user.id);
  revalidatePath('/admin/verification');
}

async function rejectDomain(domainId: string, companyId: string, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const note = String(formData.get(`note_${domainId}`) ?? '').trim();
  await supabase.from('domain_verifications').update({ status: 'failed', last_checked_at: new Date().toISOString() }).eq('id', domainId);
  await supabase.from('moderation_actions').insert({
    moderator_id: user.id,
    target_type: 'domain',
    target_id: domainId,
    action: 'reject',
    reason: note || null,
  });
  await logAudit('verify', 'domain_verifications', domainId, { status: 'failed', company_id: companyId, note }, user.id);
  revalidatePath('/admin/verification');
}

async function dnsCheck(domainId: string, domain: string, token: string) {
  'use server';
  const { supabase, user } = await staff();
  let verified = false;
  let detail = '';
  try {
    // Real DNS TXT check for _masrbounty.<domain> or <domain> itself
    const dns = await import(/* webpackIgnore: true */ 'node:dns/promises');
    const candidates = [`_masrbounty.${domain}`, domain];
    for (const host of candidates) {
      try {
        const records = await dns.resolveTxt(host);
        const flat = records.flat().join(' ');
        if (flat.includes(token)) {
          verified = true;
          detail = `TXT found at ${host}`;
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (!verified) detail = 'رمز التحقق غير موجود في سجلات TXT';
  } catch (e) {
    detail = e instanceof Error ? e.message : 'فشل فحص DNS';
  }

  await supabase
    .from('domain_verifications')
    .update({
      status: verified ? 'verified' : 'failed',
      verified_at: verified ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', domainId);

  await supabase.from('moderation_actions').insert({
    moderator_id: user.id,
    target_type: 'domain',
    target_id: domainId,
    action: verified ? 'dns_verify' : 'dns_fail',
    reason: detail,
  });
  await logAudit('verify', 'domain_verifications', domainId, { dns: true, verified, detail }, user.id);
  revalidatePath('/admin/verification');
}

// ---- Researcher / KYC / Appeal actions (kept) ----

async function decideResearcher(rowId: string, kind: string, researcherId: string, approve: boolean, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const note = String(formData.get(`note_${rowId}`) ?? '');
  await supabase
    .from('researcher_verifications')
    .update({
      status: approve ? 'verified' : 'rejected',
      verified_at: approve ? new Date().toISOString() : null,
      reviewed_by: user.id,
      review_note: note || null,
    })
    .eq('id', rowId);
  if (approve && kind === 'identity') {
    const { data: badge } = await supabase.from('badges').select('id').eq('code', 'verified-researcher').single();
    if (badge) await supabase.from('researcher_badges').upsert({ researcher_id: researcherId, badge_id: (badge as { id: string }).id }, { onConflict: 'researcher_id,badge_id' });
  }
  await logAudit('verify', 'researcher_verifications', rowId, { approve, kind }, user.id);
  revalidatePath('/admin/verification');
}

async function decideKyc(rowId: string, researcherId: string, approve: boolean, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const note = String(formData.get(`knote_${rowId}`) ?? '');
  await supabase.from('kyc_reviews').update({ status: approve ? 'verified' : 'rejected', reviewed_by: user.id, review_note: note || null }).eq('id', rowId);
  await supabase
    .from('researcher_verifications')
    .upsert(
      { researcher_id: researcherId, kind: 'identity', status: approve ? 'verified' : 'rejected', verified_at: approve ? new Date().toISOString() : null, reviewed_by: user.id, review_note: note || null },
      { onConflict: 'researcher_id,kind' }
    );
  if (approve) {
    const { data: badge } = await supabase.from('badges').select('id').eq('code', 'verified-researcher').single();
    if (badge) await supabase.from('researcher_badges').upsert({ researcher_id: researcherId, badge_id: (badge as { id: string }).id }, { onConflict: 'researcher_id,badge_id' });
  }
  await logAudit('verify', 'kyc_reviews', rowId, { approve }, user.id);
  revalidatePath('/admin/verification');
}

async function decideAppeal(appealId: string, accept: boolean, formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const resolution = String(formData.get(`ares_${appealId}`) ?? '');
  await supabase.from('appeals').update({ status: accept ? 'accepted' : 'rejected', reviewed_by: user.id, resolution: resolution || null }).eq('id', appealId);
  if (accept) {
    const { data: appeal } = await supabase.from('appeals').select('target_type,target_id').eq('id', appealId).single();
    const a = appeal as { target_type: string; target_id: string | null } | null;
    if (a?.target_type === 'user' && a.target_id) await supabase.from('profiles').update({ is_active: true }).eq('id', a.target_id);
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

type RV = { id: string; kind: string; status: string; created_at: string; researcher_id: string; researcher_profiles: { display_name: string } | null };

export default async function VerificationCenter({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = 'domains' } = await searchParams;
  const supabase = await createServerClient();

  const [{ data: rv }, { data: kyc }, { data: appeals }, { data: susp }] = await Promise.all([
    supabase
      .from('researcher_verifications')
      .select('id,kind,status,researcher_id,created_at,researcher_profiles(display_name)')
      .eq('status', 'pending')
      .order('created_at')
      .limit(50),
    supabase.from('kyc_reviews').select('id,researcher_id,status,document_path,created_at').eq('status', 'pending').order('created_at').limit(50),
    supabase.from('appeals').select('*').eq('status', 'open').order('created_at').limit(50),
    supabase.from('suspicious_events').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
  ]);

  // Domain queue: pending (+ failed for visibility) — joined with company name
  const { data: domainsRaw } = await supabase
    .from('domain_verifications')
    .select('id,domain,token,status,created_at,last_checked_at,company_id,company_profiles(name,slug)')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(100);

  const pendingDomains = (domainsRaw ?? []) as unknown as {
    id: string;
    domain: string;
    token: string;
    status: string;
    created_at: string;
    last_checked_at: string | null;
    company_id: string;
    company_profiles: { name: string; slug: string } | null;
  }[];

  const tabs = [
    { key: 'domains', label: `النطاقات (${pendingDomains.length})`, icon: Globe },
    { key: 'researchers', label: `باحثون (${rv?.length ?? 0})`, icon: ShieldCheck },
    { key: 'kyc', label: `KYC (${kyc?.length ?? 0})`, icon: CheckCircle2 },
    { key: 'suspicious', label: `مشبوه (${susp?.length ?? 0})`, icon: AlertTriangle },
    { key: 'appeals', label: `استئنافات (${appeals?.length ?? 0})`, icon: Search },
  ];

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={ShieldCheck} title="مركز التحقق" desc="طوابير التحقق: النطاقات، الباحثون، KYC، الحسابات المشبوهة والاستئنافات" />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <a
              key={t.key}
              href={`/admin/verification?tab=${t.key}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-card hover:bg-accent'}`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </a>
          );
        })}
      </div>

      {tab === 'domains' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> طابور توثيق النطاقات — معلق/فشل
            </CardTitle>
            <CardDescription>
              اعرض رمز التحقق TXT — اطلب من الشركة إضافة <code dir="ltr" className="rounded bg-muted px-1 py-0.5 font-mono text-xs">_masrbounty.&lt;domain&gt; TXT &quot;masrbounty-site-verification=TOKEN&quot;</code> ثم اضغط فحص DNS أو اعتمد يدويًا بعد المراجعة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!pendingDomains.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نطاقات معلقة.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="p-2 text-right">الشركة</th>
                      <th className="p-2 text-right">النطاق</th>
                      <th className="p-2 text-right">الرمز (Token)</th>
                      <th className="p-2 text-right">الحالة</th>
                      <th className="p-2 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDomains.map((d) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="p-2">
                          <span className="font-bold">{d.company_profiles?.name ?? '—'}</span>
                          <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                            {d.company_profiles?.slug ?? d.company_id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-xs" dir="ltr">
                          {d.domain}
                          {d.last_checked_at && <span className="block text-[11px] text-muted-foreground">آخر فحص: {new Date(d.last_checked_at).toLocaleString('ar-EG')}</span>}
                        </td>
                        <td className="p-2">
                          <code dir="ltr" className="inline-flex max-w-[220px] items-center gap-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                            {d.token}
                          </code>
                          <div className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
                            TXT: masrbounty-site-verification={d.token}
                          </div>
                        </td>
                        <td className="p-2">
                          <Badge variant={d.status === 'pending' ? 'secondary' : 'destructive'}>{d.status === 'pending' ? 'معلق' : 'فشل'}</Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1.5">
                            <form action={dnsCheck.bind(null, d.id, d.domain, d.token)}>
                              <Button size="sm" variant="outline" type="submit">
                                <Search className="ml-1 h-3 w-3" /> فحص DNS
                              </Button>
                            </form>
                            <form action={verifyDomain.bind(null, d.id, d.company_id)} className="flex gap-1">
                              <Input name={`note_${d.id}`} placeholder="ملاحظة" className="h-8 w-24 text-xs" />
                              <Button size="sm" type="submit" formAction={verifyDomain.bind(null, d.id, d.company_id)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                                <CheckCircle2 className="ml-1 h-3 w-3" /> اعتماد
                              </Button>
                            </form>
                            <form action={rejectDomain.bind(null, d.id, d.company_id)} className="flex gap-1">
                              <Input name={`note_${d.id}`} placeholder="سبب الرفض" className="h-8 w-28 text-xs" />
                              <Button size="sm" variant="destructive" type="submit" formAction={rejectDomain.bind(null, d.id, d.company_id)}>
                                <XCircle className="ml-1 h-3 w-3" /> رفض
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'researchers' && (
        <Card>
          <CardHeader>
            <CardTitle>تحقق الباحثين المعلق ({rv?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!(rv ?? []).length ? (
              <p className="text-sm text-muted-foreground">لا يوجد.</p>
            ) : (
              ((rv ?? []) as unknown as RV[]).map((r) => (
                <form key={r.id} className="mb-3 flex flex-wrap items-center gap-2 border-b pb-3 text-sm">
                  <Badge>{r.kind}</Badge>
                  <span className="font-bold">{r.researcher_profiles?.display_name ?? r.researcher_id.slice(0, 8)}</span>
                  <Input name={`note_${r.id}`} placeholder="سبب القرار" className="h-9 max-w-xs" />
                  <Button size="sm" type="submit" formAction={decideResearcher.bind(null, r.id, r.kind, r.researcher_id, true)}>
                    اعتماد
                  </Button>
                  <Button size="sm" variant="outline" type="submit" formAction={decideResearcher.bind(null, r.id, r.kind, r.researcher_id, false)}>
                    رفض
                  </Button>
                </form>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'kyc' && (
        <Card>
          <CardHeader>
            <CardTitle>مراجعات الهوية KYC ({kyc?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!(kyc ?? []).length ? (
              <p className="text-sm text-muted-foreground">لا يوجد.</p>
            ) : (
              kyc!.map((k: { id: string; researcher_id: string; document_path: string | null }) => (
                <form key={k.id} className="mb-3 flex flex-wrap items-center gap-2 border-b pb-3 text-sm">
                  <span dir="ltr" className="font-mono text-xs">
                    {k.document_path ?? '—'}
                  </span>
                  <Input name={`knote_${k.id}`} placeholder="ملاحظة" className="h-9 max-w-xs" />
                  <Button size="sm" type="submit" formAction={decideKyc.bind(null, k.id, k.researcher_id, true)}>
                    اعتماد + شارة
                  </Button>
                  <Button size="sm" variant="outline" type="submit" formAction={decideKyc.bind(null, k.id, k.researcher_id, false)}>
                    رفض
                  </Button>
                </form>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'suspicious' && (
        <Card>
          <CardHeader>
            <CardTitle>حسابات مشبوهة ({susp?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!(susp ?? []).length ? (
              <p className="text-sm text-muted-foreground">لا يوجد.</p>
            ) : (
              susp!.map((s: { id: string; kind: string; detail: string | null; severity: string }) => (
                <form key={s.id} className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2 text-sm">
                  <Badge variant={s.severity === 'high' ? 'destructive' : 'secondary'}>{s.severity}</Badge>
                  <span className="font-bold" dir="ltr">
                    {s.kind}
                  </span>
                  <span className="text-muted-foreground">{s.detail}</span>
                  <Button size="sm" variant="outline" type="submit" formAction={reviewSuspicious.bind(null, s.id, false)}>
                    رُوجعت
                  </Button>
                  <Button size="sm" variant="ghost" type="submit" formAction={reviewSuspicious.bind(null, s.id, true)}>
                    تجاهل
                  </Button>
                </form>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'appeals' && (
        <Card>
          <CardHeader>
            <CardTitle>الاستئنافات ({appeals?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!(appeals ?? []).length ? (
              <p className="text-sm text-muted-foreground">لا يوجد.</p>
            ) : (
              appeals!.map((a: { id: string; target_type: string; reason: string }) => (
                <form key={a.id} className="mb-3 border-b pb-3 text-sm">
                  <p>
                    <b dir="ltr">{a.target_type}</b> — {a.reason}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Input name={`ares_${a.id}`} placeholder="حيثيات القرار" className="h-9 max-w-xs" />
                    <Button size="sm" type="submit" formAction={decideAppeal.bind(null, a.id, true)}>
                      قبول (يفك الإيقاف)
                    </Button>
                    <Button size="sm" variant="outline" type="submit" formAction={decideAppeal.bind(null, a.id, false)}>
                      رفض
                    </Button>
                  </div>
                </form>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
