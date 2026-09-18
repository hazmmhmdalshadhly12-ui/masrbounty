'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X, Loader2, AppWindow, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';

type ApiResult = {
  ok: boolean;
  query?: string;
  programs?: { id: string; name: string; slug: string; description: string | null }[];
  researchers?: { id: string; display_name: string; country?: string | null; skills?: string[] | null }[];
  error?: string;
};

export function GlobalSearchClient({
  initialQ = '',
  initialType = 'all',
}: {
  initialQ?: string;
  initialType?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const debounced = useDebounce(q, 350);
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Update URL debounced (keeps server results in sync for share/bookmark)
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (debounced === current) return;
    const next = new URLSearchParams(params.toString());
    if (debounced.trim().length >= 2) next.set('q', debounced.trim());
    else if (!debounced.trim()) next.delete('q');
    else return; // 1 char: don't push yet
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }, [debounced, params, pathname, router]);

  // Live fetch for instant feedback (uses /api/search)
  useEffect(() => {
    const query = debounced.trim();
    if (query.length < 2) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json() as Promise<ApiResult>)
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setData({ ok: false, error: 'تعذر البحث' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const type = (params.get('type') ?? initialType) as 'all' | 'programs' | 'researchers';
  const typeHref = (t: string) => {
    const next = new URLSearchParams(params.toString());
    if (t === 'all') next.delete('type');
    else next.set('type', t);
    return `${pathname}?${next.toString()}`;
  };

  const showPrograms = type === 'all' || type === 'programs';
  const showResearchers = type === 'all' || type === 'researchers';

  return (
    <div className="space-y-4" dir="rtl">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في البرامج والباحثين…"
          aria-label="البحث العام"
          className="pr-9"
          autoFocus
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="مسح البحث"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && <Loader2 className="pointer-events-none absolute left-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={typeHref('all')}
          className={
            type === 'all'
              ? 'rounded-full border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900'
              : 'rounded-full border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground'
          }
        >
          الكل
        </Link>
        <Link
          href={typeHref('programs')}
          className={
            type === 'programs'
              ? 'rounded-full border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900'
              : 'rounded-full border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground'
          }
        >
          البرامج
        </Link>
        <Link
          href={typeHref('researchers')}
          className={
            type === 'researchers'
              ? 'rounded-full border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900'
              : 'rounded-full border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground'
          }
        >
          الباحثون
        </Link>
      </div>

      {/* Live preview (client-fetched) */}
      {data && debounced.trim().length >= 2 && (
        <div className="space-y-3">
          {!data.ok ? (
            <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{data.error}</p>
          ) : (
            <>
              {showPrograms && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-black">
                    <AppWindow className="h-4 w-4" /> البرامج ({data.programs?.length ?? 0})
                  </h3>
                  {!data.programs?.length ? (
                    <p className="text-sm text-muted-foreground">لا برامج مطابقة.</p>
                  ) : (
                    data.programs!.slice(0, 8).map((p) => (
                      <Link key={p.id} href={`/programs/${p.slug}`}>
                        <Card className="mb-2 transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-3 p-4">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
                              <AppWindow className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-bold">{p.name}</span>
                              {p.description && <span className="block truncate text-xs text-muted-foreground">{p.description}</span>}
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </div>
              )}
              {showResearchers && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-black">
                    <Users className="h-4 w-4" /> الباحثون ({data.researchers?.length ?? 0})
                  </h3>
                  {!data.researchers?.length ? (
                    <p className="text-sm text-muted-foreground">لا باحثين مطابقين.</p>
                  ) : (
                    data.researchers!.slice(0, 8).map((r) => (
                      <Link key={r.id} href={`/researchers/${encodeURIComponent(r.display_name)}`}>
                        <Card className="mb-2 transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-3 p-4">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a1628] font-black text-amber-400">
                              {r.display_name.charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold">{r.display_name}</span>
                              {r.country && <span className="text-xs text-muted-foreground">{r.country}</span>}
                            </span>
                            {!!r.skills?.length && (
                              <Badge variant="secondary" className="hidden sm:inline-flex">
                                {r.skills.slice(0, 2).join(' • ')}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">نتائج فورية من /api/search — البحث الكامل أدناه للنتائج الموثقة بالخادم.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
