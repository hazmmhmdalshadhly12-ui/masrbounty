import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="جارٍ تحميل البرنامج">
      <div className="border-b bg-muted/40">
        <div className="container max-w-5xl py-8">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-8 w-64" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-16 w-full max-w-3xl" />
        </div>
      </div>
      <div className="container grid max-w-5xl gap-6 py-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </main>
  );
}
