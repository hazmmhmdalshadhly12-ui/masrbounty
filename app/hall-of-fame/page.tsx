import Link from 'next/link';
import { Trophy, Building2, ShieldCheck } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';
import { Avatar } from '@/components/shared/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { timeAgo } from '@/utils/time';

export const dynamic = 'force-dynamic';

type HofRow = {
  id: string;
  researcher_id: string;
  company_id: string | null;
  program_id: string | null;
  achievement: string;
  display_name: string;
  recognized_at: string;
  company_profiles: { id: string; name: string; slug: string; logo_url: string | null; is_verified: boolean } | null;
};

export default async function HallOfFamePage() {
  const supabase = await createServerClient();

  // Fetch with company join; consent check is done post-fetch by joining researcher_profiles.is_public.
  // We filter to only rows where researcher consent (is_public) holds.
  const { data: raw } = await supabase
    .from('hall_of_fame')
    .select('id,researcher_id,company_id,program_id,achievement,display_name,recognized_at,company_profiles(id,name,slug,logo_url,is_verified)')
    .order('recognized_at', { ascending: false })
    .limit(200);

  const rows = (raw ?? []) as unknown as HofRow[];

  // Consent check: only show entries where researcher_profiles.is_public = true
  let consentedIds = new Set<string>();
  if (rows.length) {
    const rIds = [...new Set(rows.map((r) => r.researcher_id))];
    const { data: rps } = await supabase.from('researcher_profiles').select('id,is_public').in('id', rIds);
    for (const rp of (rps ?? []) as { id: string; is_public: boolean }[]) {
      if (rp.is_public) consentedIds.add(rp.id);
    }
  }
  const filtered = rows.filter((r) => consentedIds.has(r.researcher_id));

  // Also fetch program names for richer context (optional)
  const programIds = [...new Set(filtered.map((r) => r.program_id).filter(Boolean) as string[])];
  const programById = new Map<string, { name: string; slug: string }>();
  if (programIds.length) {
    const { data: progs } = await supabase.from('programs').select('id,name,slug').in('id', programIds);
    for (const p of (progs ?? []) as { id: string; name: string; slug: string }[]) programById.set(p.id, p);
  }

  // Group by company (null -> "مستقل / عام")
  const groups = new Map<string, { company: HofRow['company_profiles']; entries: HofRow[] }>();
  for (const r of filtered) {
    const key = r.company_id ?? '__general__';
    const existing = groups.get(key);
    if (existing) existing.entries.push(r);
    else groups.set(key, { company: r.company_profiles, entries: [r] });
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].entries.length - a[1].entries.length);

  return (
    <main dir="rtl" lang="ar">
      <PageHero kicker="تكريم مستحق" title="قاعة المشاهير" desc="باحثون كرّمتهم الشركات علنًا على اكتشافاتهم المميزة — تُعرض فقط التكريمات بموافقة الباحث." />
      <section className="container py-10">
        {!filtered.length ? (
          <EmptyState
            title="لا تكريمات منشورة بعد"
            hint="عندما تختار شركة تكريم باحث وتوافق على النشر، سيظهر هنا مجمّعًا حسب الشركة. نعرض فقط التكريمات بموافقة الباحث (الملف العام)."
            icon={Trophy}
          />
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{filtered.length} تكريم</Badge>
              <Badge variant="outline">{sortedGroups.length} شركة</Badge>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> تُعرض فقط بموافقة الباحث (is_public)
              </span>
            </div>

            {sortedGroups.map(([key, group]) => (
              <Card key={key} className="overflow-hidden">
                <CardHeader className="bg-muted/40">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white dark:bg-slate-900">
                      {group.company?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={group.company.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">
                        {group.company ? (
                          <Link href={`/companies/${group.company.slug}`} className="hover:underline">
                            {group.company.name}
                          </Link>
                        ) : (
                          'تكريم عام'
                        )}
                      </CardTitle>
                      <CardDescription>
                        {group.entries.length} تكريم {group.company?.is_verified ? '• شركة موثقة ✓' : ''}
                      </CardDescription>
                    </div>
                    <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid gap-px bg-border md:grid-cols-2">
                    {group.entries.map((h) => {
                      const prog = h.program_id ? programById.get(h.program_id) : null;
                      return (
                        <div key={h.id} className="flex gap-4 bg-card p-5">
                          <Avatar name={h.display_name} size="lg" />
                          <div className="min-w-0 flex-1">
                            <p className="font-black leading-snug">{h.display_name}</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.achievement}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{timeAgo(h.recognized_at)}</span>
                              {prog && (
                                <Link href={`/programs/${prog.slug}`} className="underline decoration-dotted hover:text-foreground">
                                  {prog.name}
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            <p className="text-center text-xs text-muted-foreground">
              تختار كل شركة بنفسها من تكرّمه؛ لا تظهر التكريمات إلا بموافقة الباحث (الملف العام مفعل).
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
