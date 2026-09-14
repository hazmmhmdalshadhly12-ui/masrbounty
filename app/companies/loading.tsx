import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="container py-10" aria-busy="true" aria-label="جارٍ تحميل الشركات">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="mt-4 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
