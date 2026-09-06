'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';

export function ProgramSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  const debounced = useDebounce(q, 400);

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (debounced === current) return;
    const next = new URLSearchParams(params.toString());
    if (debounced.trim()) next.set('q', debounced.trim());
    else next.delete('q');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [debounced, params, pathname, router]);

  return (
    <div className="relative max-w-xl flex-1">
      <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث باسم البرنامج…"
        aria-label="البحث في البرامج"
        className="border-slate-700 bg-white/10 pr-9 text-white placeholder:text-slate-400"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ('')}
          aria-label="مسح البحث"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
