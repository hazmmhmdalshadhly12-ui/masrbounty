import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="py-2" aria-busy="true" aria-label="جارٍ تحميل مساحة العمل">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-40 rounded-xl" />
    </div>
  );
}
