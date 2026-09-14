import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
  title?: string;
}

export function CardSkeleton({ count = 3, title, className, ...props }: CardSkeletonProps) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)} aria-busy="true" aria-label={title ?? 'جارٍ التحميل'} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="mt-4 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-2/3" />
          <Skeleton className="mt-5 h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
