'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container py-10">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-black">تعذر عرض الوثيقة</h2>
          <p className="mt-2 text-sm text-muted-foreground">حاول تحديث الصفحة أو العودة إلى مركز السياسات.</p>
          {error?.digest && <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">ref: {error.digest}</p>}
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={reset} size="sm" className="bg-slate-900 font-bold text-white hover:bg-slate-700">إعادة المحاولة</Button>
            <Button asChild variant="outline" size="sm"><Link href="/legal">مركز السياسات</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
