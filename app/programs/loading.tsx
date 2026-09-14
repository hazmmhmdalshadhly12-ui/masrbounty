import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="جارٍ تحميل البرامج">
      <div className="bg-[#0a1628]">
        <div className="container py-12">
          <Skeleton className="h-6 w-32 rounded-full bg-white/10" />
          <Skeleton className="mt-3 h-9 w-64 bg-white/10" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl bg-white/10" />
          <Skeleton className="mt-6 h-10 w-full max-w-xl bg-white/10" />
        </div>
      </div>
      <section className="container py-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="mt-4 h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-5 h-9 w-full" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
