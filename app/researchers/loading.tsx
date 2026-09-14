import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="container py-10" aria-busy="true" aria-label="جارٍ تحميل الباحثين">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 text-center">
            <Skeleton className="mx-auto h-14 w-14 rounded-full" />
            <Skeleton className="mx-auto mt-3 h-5 w-1/2" />
            <Skeleton className="mx-auto mt-2 h-4 w-1/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
