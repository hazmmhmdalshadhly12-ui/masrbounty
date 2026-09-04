'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Err({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[60vh] items-center py-10">
        <Card className="mx-auto w-full max-w-md text-center shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-xl font-black">حدث خطأ غير متوقع</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              نعتذر — حدث عطل أثناء عرض الصفحة. جرّب إعادة المحاولة أو ارجع للرئيسية.
            </p>
            {error.digest && (
              <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">
                ref: {error.digest}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={reset} className="bg-slate-900 text-white hover:bg-slate-700">
                إعادة المحاولة
              </Button>
              <Link href="/">
                <Button variant="outline">الرئيسية</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
