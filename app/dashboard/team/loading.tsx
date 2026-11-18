import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="py-2" aria-busy="true" aria-label="جارٍ تحميل فريقك">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
