import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="py-2" aria-busy="true" aria-label="جارٍ تحميل لوحتك">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
