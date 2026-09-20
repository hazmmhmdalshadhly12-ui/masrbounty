import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { OnboardingWizard } from '@/components/company/onboarding-wizard';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';

export const dynamic = 'force-dynamic';

type CompanyRow = { id: string; name: string; slug: string };
type DomainRow = { id: string; domain: string; token?: string; verification_token_plain?: string | null; status: string; verified_at: string | null; created_at: string; expires_at?: string | null };

function mapDomain(r: Record<string, unknown>): DomainRow & { token: string; expires_at?: string | null } {
  const token = (r['verification_token_plain'] as string | null) ?? (r['token'] as string | null) ?? (r['verification_token_hash'] as string | null) ?? '';
  return {
    id: String(r['id']),
    domain: String(r['domain']),
    token,
    verification_token_plain: (r['verification_token_plain'] as string | null) ?? token,
    status: String(r['status'] ?? 'pending'),
    verified_at: (r['verified_at'] as string | null) ?? null,
    created_at: String(r['created_at'] ?? new Date().toISOString()),
    expires_at: (r['expires_at'] as string | null) ?? null,
  };
}

export default async function CompanyOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=%2Fcompany%2Fonboarding');
  const qs = searchParams ? await searchParams : {};

  const userId = auth.user.id;

  // Resolve company: owned first, then membership
  const { data: owned } = await supabase.from('company_profiles').select('id,name,slug').eq('owner_id', userId).limit(5);
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id, company_profiles(id,name,slug)')
    .eq('user_id', userId)
    .limit(5);

  let company: CompanyRow | null = null;
  if (owned && owned.length > 0) {
    company = owned[0] as CompanyRow;
  } else if (memberships && memberships.length > 0) {
    const first = memberships[0] as unknown as { company_profiles: CompanyRow | null };
    if (first.company_profiles) company = first.company_profiles;
  }

  let domains: Array<DomainRow & { token: string }> = [];
  let isVerified = false;

  if (company) {
    // Try company_domains (new) — tolerate missing table
    try {
      const { data, error } = await supabase
        .from('company_domains')
        .select('id,domain,verification_token_plain,token,verification_token_hash,status,verified_at,created_at,expires_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        domains = (data as unknown as Record<string, unknown>[]).map(mapDomain);
      } else if (error && /does not exist|relation/i.test(error.message)) {
        // fallback to legacy
        const { data: leg } = await supabase
          .from('domain_verifications')
          .select('id,domain,token,status,verified_at,created_at')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false });
        if (leg) domains = (leg as unknown as Record<string, unknown>[]).map(mapDomain);
      }
    } catch {
      try {
        const { data: leg } = await supabase
          .from('domain_verifications')
          .select('id,domain,token,status,verified_at,created_at')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false });
        if (leg) domains = (leg as unknown as Record<string, unknown>[]).map(mapDomain);
      } catch {
        /* no domains */
      }
    }

    const now = new Date();
    isVerified = domains.some((d) => {
      if (d.status !== 'verified') return false;
      const rec = d as unknown as { expires_at?: string | null };
      if (rec.expires_at) return new Date(rec.expires_at as string) > now;
      return true;
    });

    // Also check legacy explicitly if not verified via new table
    if (!isVerified) {
      try {
        const { data: leg2 } = await supabase
          .from('domain_verifications')
          .select('id')
          .eq('company_id', company.id)
          .eq('status', 'verified')
          .limit(1);
        if (leg2 && leg2.length > 0) isVerified = true;
      } catch {
        /* ignore */
      }
    }
  }

  // Derive current step (1..4) — Create Org → Add Domain → Verify Domain → Verified → Create Program (CTA in step 4)
  let currentStep = 1;
  if (!company) currentStep = 1;
  else if (domains.length === 0) currentStep = 2;
  else if (!isVerified) currentStep = 3;
  else currentStep = 4;

  // Redirect if already verified (progress complete) — allow ?stay=1 to remain on page for domain management
  if (isVerified && company && qs['stay'] !== '1' && qs['view'] !== '1') {
    // Fully onboarded: send to program creation or dashboard
    redirect('/company/programs/new');
  }

  const wizardDomains = domains.map((d) => ({
    id: d.id,
    domain: d.domain,
    token: (d as unknown as { token: string }).token ?? (d.verification_token_plain ?? ''),
    status: d.status,
    verified_at: d.verified_at,
    created_at: d.created_at,
    expires_at: (d as unknown as { expires_at?: string | null }).expires_at ?? null,
  }));

  return (
    <div className="py-2">
      <PageHeader
        icon={Building2}
        title="تأهيل الشركة"
        desc="أكمل الخطوات الأربع لتوثيق مؤسستك وبدء برامج المكافآت"
        action={
          <Link href="/company/settings" className="text-xs underline">
            الإعدادات
          </Link>
        }
      />

      {/* Optional skip if already verified — still show wizard but with CTA */}
      {currentStep === 4 && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">مؤسستك موثّقة بالفعل — يمكنك إدارة النطاقات من الإعدادات.</CardContent>
        </Card>
      )}

      <OnboardingWizard company={company} domains={wizardDomains} currentStep={currentStep} isVerified={isVerified} />

      {/* quick nav for existing company */}
      {company && (
        <div className="mt-6 flex gap-2 text-xs">
          <Link href="/company" className="underline">
            لوحة التحكم
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/company/team" className="underline">
            الفريق
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/company/settings" className="underline">
            إدارة النطاقات
          </Link>
        </div>
      )}
    </div>
  );
}
