import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="bg-background">
      <div className="container grid min-h-[60vh] items-center py-10">
        <Card className="mx-auto w-full max-w-md text-center">
          <CardContent className="p-10">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <SearchX className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="mt-4 font-mono text-sm text-muted-foreground" dir="ltr">
              404
            </p>
            <h1 className="mt-1 text-xl font-black">الصفحة غير موجودة</h1>
            <p className="mt-2 text-sm text-muted-foreground">الرابط الذي تبحث عنه غير موجود أو تم نقله.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/">
                <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-700">
                  الرئيسية
                </Button>
              </Link>
              <Link href="/programs">
                <Button size="sm" variant="outline">
                  تصفح البرامج
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
