'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-2">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="p-8">
          <h2 className="text-lg font-black">تعذر تحميل مساحة الشركة</h2>
          <p className="mt-2 text-sm text-muted-foreground">حدث عطل أثناء جلب بيانات شركتك. جرّب إعادة المحاولة.</p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">
              ref: {error.digest}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={reset} size="sm" className="bg-slate-900 text-white hover:bg-slate-700">
              إعادة المحاولة
            </Button>
            <Link href="/company">
              <Button variant="outline" size="sm">
                مساحة الشركة
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
