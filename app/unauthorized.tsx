import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Unauthorized() {
  return (
    <div className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[60vh] items-center py-10">
        <Card className="mx-auto w-full max-w-md text-center shadow-xl">
          <CardContent className="p-8">
            <p className="font-mono text-5xl font-black" dir="ltr">401</p>
            <h1 className="mt-3 text-xl font-black">يلزم تسجيل الدخول</h1>
            <p className="mt-2 text-sm text-muted-foreground">انتهت الجلسة أو لم تسجّل الدخول بعد.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild><Link href="/login">تسجيل الدخول</Link></Button>
              <Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
