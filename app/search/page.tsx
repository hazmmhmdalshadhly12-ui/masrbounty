import Link from 'next/link';
import { Search as SearchIcon, AppWindow, Users, ShieldCheck } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/avatar';
import { escapeLike } from '@/utils/search';
import { GlobalSearchClient } from '@/components/search/global-search-client';

type SearchParams = { q?: string; type?: string };

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q: rawQ, type: rawType } = await searchParams;
  const q = (rawQ ?? '').trim();
  const type = rawType === 'programs' ? 'programs' : rawType === 'researchers' ? 'researchers' : 'all';

  const supabase = await createServerClient();

  let programs: { id: string; name: string; slug: string; description: string | null }[] = [];
  let researchers: { id: string; display_name: string; country: string | null; skills: string[] | null }[] = [];
  let programCount: number | null = null;
  let researcherCount: number | null = null;

  if (q.length >= 2) {
    const like = `%${escapeLike(q)}%`;
    const promises: Promise<void>[] = [];
    if (type === 'all' || type === 'programs') {
      promises.push(
        (supabase
          .from('programs')
          .select('id,name,slug,description')
          .eq('status', 'active')
          .eq('visibility', 'public')
          .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
          .limit(20)
          .then((r) => {
            programs = (r.data ?? []) as typeof programs;
            if (r.error) throw r.error;
          }) as unknown as Promise<void>)
      );
    }
    if (type === 'all' || type === 'researchers') {
      promises.push(
        (supabase
          .from('researcher_profiles')
          .select('id,display_name,country,skills')
          .eq('is_public', true)
          .ilike('display_name', like)
          .limit(20)
          .then((r) => {
            researchers = (r.data ?? []) as typeof researchers;
            if (r.error) throw r.error;
          }) as unknown as Promise<void>)
      );
    }
    await Promise.all(promises);
  } else if (q) {
    // q too short – show counts hint
    const [{ count: pc }, { count: rc }] = await Promise.all([
      supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('visibility', 'public'),
      supabase.from('researcher_profiles').select('id', { count: 'exact', head: true }).eq('is_public', true),
    ]);
    programCount = pc;
    researcherCount = rc;
  }

  // We need usernames for researcher profile links: fetch mapping display_name -> username via profiles join indirectly
  // researcher_profiles has user_id -> profiles.username ; fetch for displayed researchers
  const usernameByResearcherId = new Map<string, string>();
  if (researchers.length) {
    const rIds = researchers.map((r) => r.id);
    const { data: rps } = await supabase.from('researcher_profiles').select('id,user_id').in('id', rIds);
    const userIds = (rps ?? []).map((r: { user_id: string }) => r.user_id);
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id,username').in('id', userIds);
      const userToName = new Map((profs ?? []).map((p: { id: string; username: string }) => [p.id, p.username] as const));
      for (const rp of (rps ?? []) as { id: string; user_id: string }[]) {
        const uname = userToName.get(rp.user_id);
        if (uname) usernameByResearcherId.set(rp.id, uname);
      }
    }
  }

  return (
    <main dir="rtl" lang="ar">
      <PageHero kicker="دوّر بسرعة" title="البحث" desc="ابحث في البرامج النشطة العامة والباحثين العلنيين — نتائج فورية مع debounce." />
      <section className="container max-w-3xl py-8">
        <GlobalSearchClient initialQ={q} initialType={type} />

        <div className="mt-8 space-y-6">
          {q.length === 1 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                اكتب حرفين على الأقل للبحث. يوجد {programCount ?? '—'} برنامج عام و {researcherCount ?? '—'} باحث علني.
              </CardContent>
            </Card>
          )}

          {q.length >= 2 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">“{q}”</Badge>
                <span className="text-muted-foreground">
                  {type === 'programs' ? `${programs.length} برنامج` : type === 'researchers' ? `${researchers.length} باحث` : `${programs.length} برنامج • ${researchers.length} باحث`}
                </span>
              </div>

              {(type === 'all' || type === 'programs') && (
                <div className="space-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-black">
                    <AppWindow className="h-4 w-4" /> البرامج
                  </h2>
                  {!programs.length ? (
                    <Card>
                      <CardContent className="p-6 text-center text-sm text-muted-foreground">
                        <SearchIcon className="mx-auto h-6 w-6" />
                        <p className="mt-2">لا برامج مطابقة لـ “{q}”.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    programs.map((p) => (
                      <Link key={p.id} href={`/programs/${p.slug}`}>
                        <Card className="mb-2 transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-3 p-4">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
                              <AppWindow className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold">{p.name}</span>
                              {p.description && <span className="block truncate text-xs text-muted-foreground">{p.description}</span>}
                            </span>
                            <Badge variant="secondary">عام</Badge>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </div>
              )}

              {(type === 'all' || type === 'researchers') && (
                <div className="space-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-black">
                    <Users className="h-4 w-4" /> الباحثون
                  </h2>
                  {!researchers.length ? (
                    <Card>
                      <CardContent className="p-6 text-center text-sm text-muted-foreground">
                        <ShieldCheck className="mx-auto h-6 w-6" />
                        <p className="mt-2">لا باحثون علنيون مطابقون لـ “{q}”.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    researchers.map((r) => {
                      const uname = usernameByResearcherId.get(r.id);
                      const href = uname ? `/researchers/${encodeURIComponent(uname)}` : `/researchers`;
                      return (
                        <Link key={r.id} href={href}>
                          <Card className="mb-2 transition-shadow hover:shadow-md">
                            <CardContent className="flex items-center gap-3 p-4">
                              <Avatar name={r.display_name} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-bold">{r.display_name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {[r.country, r.skills?.slice(0, 2).join(' • ')].filter(Boolean).join(' • ') || 'باحث علني'}
                                </span>
                              </span>
                              <Badge variant="outline">علني</Badge>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}

          {!q && (
            <Card>
              <CardContent className="p-6 text-sm leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground">جرّب البحث عن:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['web', 'api', 'mobile', 'payment', 'auth'].map((term) => (
                    <Link key={term} href={`/search?q=${encodeURIComponent(term)}`} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">
                      {term}
                    </Link>
                  ))}
                </div>
                <p className="mt-4">البرامج: تُعرض فقط العامة النشطة. الباحثون: تُعرض فقط الملفات التي فعل أصحابها العلنية.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
