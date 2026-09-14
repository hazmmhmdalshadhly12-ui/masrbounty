import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="container py-10" aria-busy="true" aria-label="جارٍ تحميل قاعة المشاهير">
      <Skeleton className="h-9 w-52" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-lg border p-6">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
