import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container max-w-4xl py-10" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
