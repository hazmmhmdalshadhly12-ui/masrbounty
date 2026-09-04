import Link from 'next/link';
import { BadgeCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function WelcomePage() {
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center py-10">
        <Card className="mx-auto w-full max-w-md text-center shadow-xl">
          <CardContent className="p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950">
              <BadgeCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-2xl font-black">تم تأكيد بريدك بنجاح</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              حسابك الآن مفعّل. سجّل الدخول للوصول إلى لوحتك وبدء العمل على البرامج.
            </p>
            <Link href="/login" className="mt-6 block">
              <Button className="w-full bg-slate-900 font-bold text-white hover:bg-slate-700">
                تسجيل الدخول <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
