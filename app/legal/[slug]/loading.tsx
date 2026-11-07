import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container max-w-3xl py-8" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-40" />
      <Skeleton className="mt-6 h-96 w-full rounded-xl" />
    </div>
  );
}
