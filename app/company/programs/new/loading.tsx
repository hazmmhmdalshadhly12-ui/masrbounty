import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function Loading() {
  return (
    <main className="container max-w-4xl py-8" aria-busy="true" aria-label="جارٍ تحميل معالج البرنامج">
      <div className="mb-6 text-center">
        <Skeleton className="mx-auto h-7 w-64" />
        <Skeleton className="mx-auto mt-2 h-4 w-80" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="flex justify-between pt-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
