import Link from 'next/link';
import { AppWindow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface SearchProgramRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

interface SearchResultsProps extends React.HTMLAttributes<HTMLDivElement> {
  programs?: SearchProgramRow[];
  query?: string;
  title?: string;
}

export function SearchResults({ programs = [], query, title = 'نتائج البحث', className, ...props }: SearchResultsProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {title && <h3 className="px-1 text-sm font-bold text-muted-foreground">{title}</h3>}
      {query && !programs.length && (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          لا نتائج عن “{query}” — جرّب كلمة أخرى.
        </p>
      )}
      {programs.map((p) => (
        <Link key={p.id} href={`/programs/${p.slug}`}>
          <Card className="transition-shadow hover:shadow-md">
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
      ))}
    </div>
  );
}
