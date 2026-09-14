'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  title?: string;
  hint?: string;
  digest?: string;
  reset?: () => void;
  homeHref?: string;
}

export function ErrorFallback({
  title = 'حدث خطأ غير متوقع',
  hint = 'نعتذر — حدث عطل أثناء عرض هذا الجزء. جرّب إعادة المحاولة أو ارجع للرئيسية.',
  digest,
  reset,
  homeHref = '/',
}: ErrorFallbackProps) {
  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardContent className="p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
        </span>
        <h2 className="mt-4 text-lg font-black">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        {digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">
            ref: {digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          {reset && (
            <Button onClick={reset} size="sm" className="bg-slate-900 text-white hover:bg-slate-700">
              إعادة المحاولة
            </Button>
          )}
          <Link href={homeHref}>
            <Button variant="outline" size="sm">
              الرئيسية
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
