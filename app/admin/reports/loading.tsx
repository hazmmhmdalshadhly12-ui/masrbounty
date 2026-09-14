import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="py-2" aria-busy="true" aria-label="جارٍ تحميل تقارير الإدارة">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-5 overflow-hidden rounded-lg border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b p-4 last:border-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
