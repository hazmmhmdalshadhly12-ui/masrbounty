import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { slugify } from '@/utils/slug';
import { DomainsManager } from '@/components/company/domains-manager';

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
  const { data: ownedCompany } = await supabase.from('company_profiles').select('*').eq('owner_id', user.user.id).maybeSingle();
  let company = ownedCompany as unknown as { id: string; name: string; slug: string; description: string | null; website: string | null } | null;
  if (!company) {
    const { data: mem } = await supabase.from('company_members').select('company_id').eq('user_id', user.user.id).limit(1).maybeSingle();
    if (mem) {
      const { data: c2 } = await supabase.from('company_profiles').select('*').eq('id', (mem as { company_id: string }).company_id).maybeSingle();
      company = c2 as typeof company;
    }
  }
  let companyDomains: { id: string; domain: string; token: string; status: string; verified_at: string | null; expires_at: string | null; created_at: string | null }[] = [];
  if (company) {
    try {
      const { data: cds } = await supabase
        .from('company_domains')
        .select('id,domain,verification_token_plain,token,verification_token_hash,status,verified_at,created_at,expires_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (cds) {
        companyDomains = (cds as unknown as Record<string, unknown>[]).map((r) => ({
          id: String(r['id']),
          domain: String(r['domain']),
          token: (r['verification_token_plain'] as string | null) ?? (r['token'] as string | null) ?? (r['verification_token_hash'] as string | null) ?? '',
          status: String(r['status'] ?? 'pending'),
          verified_at: (r['verified_at'] as string | null) ?? null,
          expires_at: (r['expires_at'] as string | null) ?? null,
          created_at: (r['created_at'] as string | null) ?? null,
        }));
        const now = Date.now();
        companyDomains = companyDomains.map((d) => {
          if (d.expires_at && new Date(d.expires_at).getTime() < now && d.status === 'verified') {
            return { ...d, status: 'expired' };
          }
          return d;
        });
      }
    } catch {
      companyDomains = [];
    }
  }
  return (
    <main className="container py-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">إعدادات الشركة</h1>
      <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent>
        <form action={saveCompany} className="space-y-3">
          <Input name="name" required defaultValue={company?.name ?? ''} placeholder="Company name" />
          <Input name="slug" required defaultValue={company?.slug ?? ''} placeholder="slug" dir="ltr" />
          <Input name="description" defaultValue={company?.description ?? ''} placeholder="Description" />
          <Input name="website" defaultValue={company?.website ?? ''} placeholder="https://…" dir="ltr" />
          <Button type="submit">Save</Button>
        </form>
      </CardContent></Card>
      {company && <DomainsManager companyId={company.id} initialDomains={companyDomains} />}
      {!company && <p className="text-sm text-muted-foreground">أنشئ مؤسستك أولًا من <a href="/company/onboarding" className="underline">صفحة التأهيل</a>.</p>}
    </main>
  );
}
