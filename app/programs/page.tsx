import Link from 'next/link';
import { AppWindow, ArrowLeft, ShieldCheck, Search, Building2, Filter, X } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { escapeLike } from '@/utils/search';
import { cn } from '@/lib/utils';

type SearchParams = {
  q?: string;
  sort?: string;
  page?: string;
  severity?: string;
  tech?: string;
  verified?: string;
  bounty?: string;
  min?: string;
  max?: string;
};

const PER_PAGE = 9;

const bountyPresets: { value: string; label: string; min?: number; max?: number }[] = [
  { value: 'all', label: 'كل المكافآت' },
  { value: '0-500', label: 'حتى 500 EGP', min: 0, max: 500 },
  { value: '500-2000', label: '500 – 2,000 EGP', min: 500, max: 2000 },
  { value: '2000-10000', label: '2,000 – 10,000 EGP', min: 2000, max: 10000 },
  { value: '10000+', label: '10,000+ EGP', min: 10000 },
];

const severityOptions = [
  { value: 'critical', label: 'حرجة' },
  { value: 'high', label: 'عالية' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'low', label: 'منخفضة' },
  { value: 'informational', label: 'معلوماتية' },
] as const;

const techOptions = [
  { value: 'web', label: 'Web' },
  { value: 'api', label: 'API' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'network', label: 'Network' },
  { value: 'other', label: 'Other' },
] as const;

function parseList(v?: string): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function buildHref(base: URLSearchParams, overrides: Record<string, string | undefined | null>): string {
  const next = new URLSearchParams(base.toString());
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null || v === '' || v === 'all') next.delete(k);
    else next.set(k, v);
  }
  const s = next.toString();
  return s ? `/programs?${s}` : '/programs';
}

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const q = (raw.q ?? '').trim();
  const sort = raw.sort ?? 'new';
  const page = Math.max(1, parseInt(raw.page ?? '1', 10) || 1);
  const severityFilter = parseList(raw.severity);
  const techFilter = parseList(raw.tech);
  const verifiedOnly = raw.verified === '1' || raw.verified === 'true';
  const bountyKey = raw.bounty ?? 'all';
  const preset = bountyPresets.find((p) => p.value === bountyKey) ?? bountyPresets[0]!;
  // allow explicit min/max overrides
  const bountyMin = raw.min != null && raw.min !== '' ? Number(raw.min) : preset.min;
  const bountyMax = raw.max != null && raw.max !== '' ? Number(raw.max) : preset.max;

  const supabase = await createServerClient();

  // Public directory — anon sees ONLY public+active via can_view_program (RLS).
  // private / invite_only are hidden here even if RLS were bypassed; paused/draft/closed also hidden via status=active.
  let query = supabase
    .from('programs')
    .select('id,name,slug,description,status,visibility,created_at,company_id,logo_url')
    .eq('status', 'active')
    .eq('visibility', 'public');

  if (q) {
    const like = `%${escapeLike(q)}%`;
    query = query.or(`name.ilike.${like},description.ilike.${like},slug.ilike.${like}`);
  }

  // Sorting base; reward sort is applied after enrichment
  if (sort !== 'reward') {
    query = query.order('created_at', { ascending: sort === 'old' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Fetch broader set then filter in-memory to support cross-table filters without RPC.
  // Limit to 100 for public directory (keeps queries fast and avoids deep pagination scan).
  query = query.limit(100);
  const { data: programsRaw } = await query;
  const programs = (programsRaw ?? []) as {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    created_at: string;
    company_id: string;
    logo_url: string | null;
  }[];

  const ids = programs.map((p) => p.id);
  const companyIds = [...new Set(programs.map((p) => p.company_id))];

  const [{ data: bounties }, { data: assetRows }, { data: companies }] = ids.length
    ? await Promise.all([
        supabase.from('bounty_policies').select('program_id,severity,min_amount,max_amount').in('program_id', ids),
        supabase.from('program_assets').select('program_id,type').in('program_id', ids),
        companyIds.length
          ? supabase.from('company_profiles').select('id,name,slug,is_verified,logo_url').in('id', companyIds)
          : Promise.resolve({ data: [] as never[] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const maxByProgram = new Map<string, number>();
  const severitiesByProgram = new Map<string, Set<string>>();
  for (const b of (bounties ?? []) as { program_id: string; severity: string; max_amount: number }[]) {
    const cur = maxByProgram.get(b.program_id) ?? 0;
    maxByProgram.set(b.program_id, Math.max(cur, Number(b.max_amount)));
    const set = severitiesByProgram.get(b.program_id) ?? new Set<string>();
    set.add(String(b.severity).toLowerCase());
    severitiesByProgram.set(b.program_id, set);
  }

  const techByProgram = new Map<string, Set<string>>();
  const countByProgram = new Map<string, number>();
  for (const a of (assetRows ?? []) as { program_id: string; type: string }[]) {
    const s = techByProgram.get(a.program_id) ?? new Set<string>();
    s.add(String(a.type).toLowerCase());
    techByProgram.set(a.program_id, s);
    countByProgram.set(a.program_id, (countByProgram.get(a.program_id) ?? 0) + 1);
  }

  const companyById = new Map<string, { id: string; name: string; slug: string; is_verified: boolean; logo_url: string | null }>();
  for (const c of (companies ?? []) as { id: string; name: string; slug: string; is_verified: boolean; logo_url: string | null }[]) {
    companyById.set(c.id, c);
  }

  // In-memory filters (cross-table)
  let filtered = programs.filter((p) => {
    if (verifiedOnly) {
      const c = companyById.get(p.company_id);
      if (!c?.is_verified) return false;
    }
    if (severityFilter.length) {
      const set = severitiesByProgram.get(p.id);
      if (!set || !severityFilter.some((s) => set.has(s))) return false;
    }
    if (techFilter.length) {
      const set = techByProgram.get(p.id);
      if (!set || !techFilter.some((t) => set.has(t))) return false;
    }
    const max = maxByProgram.get(p.id) ?? 0;
    if (bountyMin != null && max < bountyMin) return false;
    if (bountyMax != null && max > bountyMax && !(bountyKey === '10000+' && max >= 10000)) {
      // For bounded presets, exclude above max
      if (bountyKey !== '10000+') return false;
    }
    if (bountyMax != null && bountyKey !== '10000+' && bountyKey !== 'all' && max > bountyMax) return false;
    return true;
  });

  // Sort
  if (sort === 'reward') {
    filtered.sort((a, b) => (maxByProgram.get(b.id) ?? 0) - (maxByProgram.get(a.id) ?? 0));
  } else if (sort === 'old') {
    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else if (sort === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } else {
    // new (default) – already ordered by created_at desc from query, but ensure
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const baseParams = new URLSearchParams();
  if (q) baseParams.set('q', q);
  if (sort && sort !== 'new') baseParams.set('sort', sort);
  if (severityFilter.length) baseParams.set('severity', severityFilter.join(','));
  if (techFilter.length) baseParams.set('tech', techFilter.join(','));
  if (verifiedOnly) baseParams.set('verified', '1');
  if (bountyKey && bountyKey !== 'all') baseParams.set('bounty', bountyKey);
  if (raw.min) baseParams.set('min', raw.min);
  if (raw.max) baseParams.set('max', raw.max);

  const hasActiveFilters = Boolean(q || severityFilter.length || techFilter.length || verifiedOnly || bountyKey !== 'all');

  return (
    <main>
      <section className="bg-[#0a1628] text-white dark:border-slate-800">
        <div className="container mx-auto max-w-6xl px-4 py-10 md:py-12">
          <span className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
            اختبار مصرح به فقط
          </span>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">برامج Bug Bounty</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
            اختر برنامجًا، اقرأ نطاقه وقواعده جيدًا، ثم ابدأ الصيد داخل الحدود المصرح بها فقط. تُعرض فقط البرامج العامة النشطة.
          </p>

          {/* Search + sort row */}
          <form method="GET" className="mt-6 flex flex-col gap-3">
            {/* preserve filter params as hidden inputs so search doesn't reset them */}
            {severityFilter.length ? <input type="hidden" name="severity" value={severityFilter.join(',')} /> : null}
            {techFilter.length ? <input type="hidden" name="tech" value={techFilter.join(',')} /> : null}
            {verifiedOnly ? <input type="hidden" name="verified" value="1" /> : null}
            {bountyKey !== 'all' ? <input type="hidden" name="bounty" value={bountyKey} /> : null}
            {raw.min ? <input type="hidden" name="min" value={raw.min} /> : null}
            {raw.max ? <input type="hidden" name="max" value={raw.max} /> : null}
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="ابحث باسم البرنامج أو الوصف…"
                  aria-label="البحث في البرامج"
                  dir="auto"
                  className="h-10 border-slate-700 bg-white/10 ps-9 text-start text-white placeholder:text-slate-400 focus-visible:ring-amber-400"
                />
              </div>
              <div className="flex gap-2">
                <select
                  name="sort"
                  defaultValue={sort}
                  aria-label="الترتيب"
                  className="h-10 rounded-md border border-slate-700 bg-white/10 px-3 text-sm text-white"
                >
                  <option value="new" className="text-black">
                    الأحدث
                  </option>
                  <option value="old" className="text-black">
                    الأقدم
                  </option>
                  <option value="reward" className="text-black">
                    الأعلى مكافأة
                  </option>
                  <option value="name" className="text-black">
                    أبجدي
                  </option>
                </select>
                <Button type="submit" variant="outline" className="border-slate-600 text-white hover:bg-white/10">
                  بحث
                </Button>
              </div>
            </div>
          </form>

          <p className="mt-3 text-xs text-slate-400">
            {total} برنامج {hasActiveFilters ? '— مُفلتر' : ''} • الترتيب: {sort === 'reward' ? 'الأعلى مكافأة' : sort === 'old' ? 'الأقدم' : sort === 'name' ? 'أبجدي' : 'الأحدث'}
          </p>
        </div>
      </section>

      <section className="container mx-auto grid max-w-6xl gap-6 px-4 py-8 grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Filters sidebar */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-black">
                  <Filter className="h-4 w-4" /> الفلاتر
                </h2>
                {hasActiveFilters && (
                  <Link href="/programs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" /> مسح
                  </Link>
                )}
              </div>

              {/* Bounty range */}
              <div>
                <p className="text-xs font-bold text-muted-foreground">نطاق المكافأة</p>
                <div className="mt-2 grid gap-1.5">
                  {bountyPresets.map((b) => {
                    const active = b.value === bountyKey;
                    return (
                      <Link
                        key={b.value}
                        href={buildHref(baseParams, { bounty: b.value, page: '1', min: null, max: null })}
                        className={cn(
                          'rounded-md border px-3 py-2 text-sm transition-colors',
                          active ? 'border-slate-900 bg-slate-900 font-bold text-white dark:bg-slate-100 dark:text-slate-900' : 'hover:bg-muted'
                        )}
                      >
                        {b.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Severity */}
              <div>
                <p className="text-xs font-bold text-muted-foreground">الخطورة</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {severityOptions.map((s) => {
                    const active = severityFilter.includes(s.value);
                    const next = active ? severityFilter.filter((x) => x !== s.value) : [...severityFilter, s.value];
                    return (
                      <Link
                        key={s.value}
                        href={buildHref(baseParams, { severity: next.join(',') || null, page: '1' })}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          active ? 'border-amber-500 bg-amber-500 font-bold text-white' : 'hover:bg-muted'
                        )}
                      >
                        {s.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Tech */}
              <div>
                <p className="text-xs font-bold text-muted-foreground">التقنية / الأصل</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {techOptions.map((t) => {
                    const active = techFilter.includes(t.value);
                    const next = active ? techFilter.filter((x) => x !== t.value) : [...techFilter, t.value];
                    return (
                      <Link
                        key={t.value}
                        href={buildHref(baseParams, { tech: next.join(',') || null, page: '1' })}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          active ? 'border-slate-900 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'hover:bg-muted'
                        )}
                      >
                        {t.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Verified */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-bold">شركات موثقة فقط</p>
                  <p className="text-xs text-muted-foreground">اعرض برامج الشركات الموثقة</p>
                </div>
                <Link
                  href={buildHref(baseParams, { verified: verifiedOnly ? null : '1', page: '1' })}
                  aria-label={verifiedOnly ? 'إلغاء فلتر الشركات الموثقة' : 'تفعيل فلتر الشركات الموثقة'}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
                    verifiedOnly ? 'border-emerald-600 bg-emerald-600' : 'border-input bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                      verifiedOnly ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </Link>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-bold">تنبيه</p>
                <p className="mt-1">الاختبار خارج النطاق المصرح به محظور. اقرأ الـ scope قبل البدء.</p>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Results */}
        <div className="min-w-0 space-y-4">
          {!paged.length ? (
            <Card className="mx-auto max-w-lg text-center">
              <CardContent className="p-10">
                <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
                <h2 className="mt-4 font-bold">{q ? `لا نتائج عن “${q}”` : hasActiveFilters ? 'لا برامج تطابق الفلاتر' : 'لا توجد برامج نشطة حاليًا'}</h2>
                <p className="mt-2 text-sm text-muted-foreground">جرّب تغيير الفلاتر أو البحث بكلمة أخرى — الشركات تضيف برامج جديدة باستمرار.</p>
                {hasActiveFilters && (
                  <Link href="/programs" className="mt-4 inline-block">
                    <Button variant="outline" size="sm">
                      مسح الفلاتر
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-1 md:grid-cols-2">
                {paged.map((p) => {
                  const max = maxByProgram.get(p.id) ?? 0;
                  const assets = countByProgram.get(p.id) ?? 0;
                  const company = companyById.get(p.company_id);
                  const severitySet = severitiesByProgram.get(p.id);
                  const techSet = techByProgram.get(p.id);
                  return (
                    <Card key={p.id} className="group flex flex-col rounded-lg border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600">
                      <CardContent className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted dark:border-slate-700 dark:bg-slate-800">
                            {p.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.logo_url} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <AppWindow className="h-5 w-5 text-muted-foreground" />
                            )}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="dark:bg-slate-800 dark:text-slate-200">عام</Badge>
                            {company?.is_verified && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                <Building2 className="h-3 w-3" /> موثقة
                              </span>
                            )}
                          </div>
                        </div>
                        <h2 className="mt-4 line-clamp-1 text-base font-black leading-snug tracking-tight" title={p.name}>
                          {p.name}
                        </h2>
                        {company && <p className="truncate text-xs font-medium text-muted-foreground">{company.name}</p>}
                        <p className="mt-2 line-clamp-2 min-h-[2.5rem] flex-1 text-sm leading-relaxed text-muted-foreground">
                          {p.description || '—'}
                        </p>
                        {!!severitySet?.size && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {[...severitySet].slice(0, 3).map((s) => (
                              <Badge key={s} variant="outline" className="border-amber-200 bg-amber-50 text-[11px] capitalize text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                {s}
                              </Badge>
                            ))}
                            {techSet && [...techSet].slice(0, 2).map((t) => (
                              <Badge key={t} variant="secondary" className="text-[11px] uppercase tracking-wide dark:bg-slate-800">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            حتى{' '}
                            <b className="tabular-nums" dir="ltr">
                              {max.toLocaleString()} EGP
                            </b>
                          </span>
                          <span>•</span>
                          <span>{assets} أصول</span>
                          <span>•</span>
                          <span>{new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <Link href={`/programs/${p.slug}`} className="mt-4">
                          <Button variant="outline" className="w-full group-hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600">
                            عرض التفاصيل <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  صفحة {safePage} من {totalPages} • {total} برنامج
                </p>
                <div className="flex items-center gap-1.5">
                    <Link
                      href={buildHref(baseParams, { page: String(Math.max(1, safePage - 1)), q: q || null, sort: sort !== 'new' ? sort : null })}
                      aria-disabled={safePage <= 1}
                      aria-label="الصفحة السابقة"
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        safePage <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
                      )}
                  >
                    السابق
                  </Link>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let n: number;
                    if (totalPages <= 5) n = i + 1;
                    else if (safePage <= 3) n = i + 1;
                    else if (safePage >= totalPages - 2) n = totalPages - 4 + i;
                    else n = safePage - 2 + i;
                    const active = n === safePage;
                    return (
                      <Link
                        key={n}
                        href={buildHref(baseParams, { page: String(n), q: q || null, sort: sort !== 'new' ? sort : null })}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-md border text-sm',
                          active ? 'border-slate-900 bg-slate-900 font-bold text-white dark:bg-slate-100 dark:text-slate-900' : 'hover:bg-muted'
                        )}
                      >
                        {n}
                      </Link>
                    );
                  })}
                  <Link
                    href={buildHref(baseParams, { page: String(Math.min(totalPages, safePage + 1)), q: q || null, sort: sort !== 'new' ? sort : null })}
                    aria-disabled={safePage >= totalPages}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm',
                      safePage >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
                    )}
                  >
                    التالي
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
