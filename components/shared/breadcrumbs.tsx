import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export function Breadcrumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="مسار التنقل" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {trail.map((t, i) => (
        <span key={t.label} className="flex items-center gap-1.5">
          {i > 0 && <ChevronLeft className="h-3 w-3 rtl:rotate-180" aria-hidden />}
          {t.href && i < trail.length - 1 ? (
            <Link href={t.href} className="hover:text-foreground hover:underline">
              {t.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-foreground">{t.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
