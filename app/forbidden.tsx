import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Forbidden() {
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[60vh] items-center py-10">
        <Card className="mx-auto w-full max-w-md text-center shadow-xl">
          <CardContent className="p-8">
            <p className="font-mono text-5xl font-black" dir="ltr">403</p>
            <h1 className="mt-3 text-xl font-black">غير مصرّح لك بالوصول</h1>
            <p className="mt-2 text-sm text-muted-foreground">هذه الصفحة تتطلب صلاحيات إدارية.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/"><Button variant="outline">الرئيسية</Button></Link>
              <Link href="/contact"><Button>تواصل معنا</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
