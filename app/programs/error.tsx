'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container py-10">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="p-8">
          <h2 className="text-lg font-black">تعذر تحميل البرامج</h2>
          <p className="mt-2 text-sm text-muted-foreground">حدث عطل أثناء جلب برامج المكافآت. جرّب إعادة المحاولة.</p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">
              ref: {error.digest}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={reset} size="sm" className="bg-slate-900 text-white hover:bg-slate-700">
              إعادة المحاولة
            </Button>
            <Link href="/programs">
              <Button variant="outline" size="sm">
                البرامج
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
