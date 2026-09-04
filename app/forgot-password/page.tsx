import Link from 'next/link';
import { ForgotForm } from '@/components/forms/forgot-form';
import { Card, CardContent } from '@/components/ui/card';

export default function ForgotPassword() {
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center py-10">
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">استعادة كلمة السر</h2>
            <p className="mt-1 text-sm text-muted-foreground">اكتب بريدك وهنبعتلك رابط التغيير.</p>
            <ForgotForm />
            <p className="mt-4 text-sm">
              <Link href="/login" className="underline">رجوع للدخول</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
