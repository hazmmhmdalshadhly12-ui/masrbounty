import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { LegalWarningBanner } from '@/components/legal/legal-warning-banner';
import { ConsentChecklist } from '@/components/legal/consent-checklist';
import { safeNext } from '@/lib/auth/redirect';
import { getRequiredAgreements } from '@/features/legal/acceptance-actions';
import type { RequiredLegalDoc } from '@/types/legal';

export const metadata = { title: 'إعادة الموافقة على السياسات | MasrBounty' };

/**
 * Re-acceptance gate: shown after login when a required policy has a newer
 * published version than the user's recorded acceptance. The user cannot
 * reach the dashboards until the new versions are accepted (versions are
 * resolved and stored server-side, immutable once accepted).
 */
export default async function LegalConsentPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/legal/consent');

  const required: RequiredLegalDoc[] = await getRequiredAgreements();
  if (required.length === 0) {
    // Nothing outstanding — never trap the user in this page.
    redirect(safeNext(next || null));
  }

  return (
    <div className="container max-w-lg py-10">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <h1 className="text-xl font-black">تحديث على السياسات</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              حُدِّثت سياسات المنصة. راجع الوثائق المحدّثة ثم وافق للمتابعة — تُسجَّل الموافقة برقم الإصدار والتاريخ ولا يمكن تعديلها لاحقًا.
            </p>
          </div>
          <ul className="space-y-1.5 text-sm">
            {required.map((d) => (
              <li key={d.slug} className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{d.title_ar}</span>
                <span className="text-xs text-muted-foreground">
                  (قبولك السابق: {d.accepted_version ?? 'لا يوجد'} — الحالي: {d.current_version})
                </span>
              </li>
            ))}
          </ul>
          <LegalWarningBanner />
          <ConsentChecklist mode="reacceptance" nextUrl={safeNext(next || null)} />
        </CardContent>
      </Card>
    </div>
  );
}
