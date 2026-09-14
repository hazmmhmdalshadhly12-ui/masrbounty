import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="container max-w-3xl py-10" aria-busy="true" aria-label="جارٍ تحميل المتصدرين">
      <Skeleton className="h-9 w-44" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mb-6 mt-5 flex gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </main>
  );
}
