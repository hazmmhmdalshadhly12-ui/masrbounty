import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { slugify } from '@/utils/slug';

async function saveCompany(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const name = String(formData.get('name'));
  const slug = slugify(String(formData.get('slug') || name));
  const { data: existing } = await supabase.from('company_profiles').select('id').eq('owner_id', user.user.id).single();
  if (existing) {
    await supabase.from('company_profiles').update({ name, slug, description: String(formData.get('description') ?? ''), website: String(formData.get('website') ?? '') }).eq('id', existing.id);
  } else {
    const { data: c } = await supabase.from('company_profiles').insert({ owner_id: user.user.id, name, slug, description: String(formData.get('description') ?? ''), website: String(formData.get('website') ?? '') }).select('id').single();
    if (c) await supabase.from('company_members').insert({ company_id: c.id, user_id: user.user.id, role: 'owner' });
  }
  revalidatePath('/company/settings');
}

export default async function CompanySettings() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: company } = await supabase.from('company_profiles').select('*').eq('owner_id', user.user.id).single();
  return (
    <main className="container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">إعدادات الشركة</h1>
      <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent>
        <form action={saveCompany} className="space-y-3">
          <Input name="name" required defaultValue={company?.name ?? ''} placeholder="Company name" />
          <Input name="slug" required defaultValue={company?.slug ?? ''} placeholder="slug" dir="ltr" />
          <Input name="description" defaultValue={company?.description ?? ''} placeholder="Description" />
          <Input name="website" defaultValue={company?.website ?? ''} placeholder="https://…" dir="ltr" />
          <Button type="submit">Save</Button>
        </form>
      </CardContent></Card>
      {company && <VerificationCard companyId={company.id} />}
      {company && <DomainCard companyId={company.id} />}
    </main>
  );
}

async function DomainCard({ companyId }: { companyId: string }) {
  const supabase = await createServerClient();
  const { data: domains } = await supabase
    .from('domain_verifications')
    .select('id,domain,token,status,verified_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  async function addDomain(formData: FormData) {
    'use server';
    const supabase = await createServerClient();
    const domain = String(formData.get('domain') ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error('Invalid domain');
    await supabase.from('domain_verifications').upsert(
      { company_id: String(formData.get('company_id')), domain, status: 'pending' },
      { onConflict: 'company_id,domain' }
    );
    revalidatePath('/company/settings');
  }

  async function checkDomain(domainId: string) {
    'use server';
    const supabase = await createServerClient();
    const { data: row } = await supabase.from('domain_verifications').select('company_id,domain,token').eq('id', domainId).single();
    if (!row) throw new Error('Not found');
    const expected = `masrbounty-verification=${row.token}`;
    let ok = false;
    try {
      const res = await fetch(`https://dns.google/resolve?name=_masrbounty.${row.domain}&type=TXT`, { cache: 'no-store' });
      const j = (await res.json()) as { Answer?: { data?: string }[] };
      const txts = (j.Answer ?? []).map((a) => (a.data ?? '').replace(/^"|"$/g, ''));
      ok = txts.some((t) => t.includes(expected));
    } catch {
      ok = false;
    }
    await supabase
      .from('domain_verifications')
      .update({ status: ok ? 'verified' : 'failed', verified_at: ok ? new Date().toISOString() : null, last_checked_at: new Date().toISOString() })
      .eq('id', domainId);
    await logAuditSafe('verify', 'domain_verifications', domainId, { ok });
    revalidatePath('/company/settings');
  }

  return (
    <Card><CardHeader><CardTitle>توثيق ملكية النطاق</CardTitle></CardHeader><CardContent className="space-y-3">
      {(domains ?? []).map((d) => (
        <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
          <span dir="ltr" className="font-mono">{d.domain}</span>
          {d.status === 'verified' ? (
            <span className="text-xs font-bold text-green-700">موثق ✓</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              أضف سجل TXT على <b dir="ltr">_masrbounty.{d.domain}</b> بقيمة <code dir="ltr" className="rounded bg-muted px-1">masrbounty-verification={d.token}</code>
            </span>
          )}
          {d.status !== 'verified' && (
            <form action={checkDomain.bind(null, d.id)}><Button size="sm" type="submit">تحقق الآن</Button></form>
          )}
        </div>
      ))}
      <form action={addDomain} className="flex gap-2">
        <input type="hidden" name="company_id" value={companyId} />
        <Input name="domain" required placeholder="example.com" dir="ltr" />
        <Button type="submit">إضافة نطاق</Button>
      </form>
    </CardContent></Card>
  );
}

async function logAuditSafe(action: 'verify', entity: string, entityId: string, meta: Record<string, unknown>) {
  try {
    const { logAudit } = await import('@/services/audit');
    const supabase = await createServerClient();
    const { data: user } = await supabase.auth.getUser();
    await logAudit(action, entity, entityId, meta, user.user?.id);
  } catch {
    /* ignore */
  }
}

async function VerificationCard({ companyId }: { companyId: string }) {
  const supabase = await createServerClient();
  const { data: verifs } = await supabase
    .from('company_verifications')
    .select('id,status,review_note,created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(5);

  async function requestVerification(formData: FormData) {
    'use server';
    const supabase = await createServerClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Unauthorized');
    const url = String(formData.get('document_url') ?? '').trim();
    if (!/^https?:\/\/.+\..+/.test(url)) throw new Error('Invalid document URL');
    await supabase.from('company_verifications').insert({
      company_id: String(formData.get('company_id')),
      document_url: url,
      status: 'pending',
    });
    revalidatePath('/company/settings');
  }

  return (
    <Card><CardHeader><CardTitle>توثيق الشركة</CardTitle></CardHeader><CardContent className="space-y-3">
      {verifs?.map((v) => (
        <p key={v.id} className="text-sm border rounded p-2">
          {v.status}{v.review_note ? ` — ${v.review_note}` : ''}
        </p>
      ))}
      <form action={requestVerification} className="flex gap-2">
        <input type="hidden" name="company_id" value={companyId} />
        <Input name="document_url" required placeholder="رابط مستند السجل التجاري (https://…)" dir="ltr" />
        <Button type="submit">طلب توثيق</Button>
      </form>
      <p className="text-xs text-muted-foreground">نراجع المستند يدويًا؛ عند القبول تظهر شارة موثقة على ملف شركتك وبرامجها.</p>
    </CardContent></Card>
  );
}
