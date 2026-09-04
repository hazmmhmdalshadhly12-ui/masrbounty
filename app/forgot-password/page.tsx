import Link from 'next/link';
import { requestResetAction } from '@/features/auth/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center py-10">
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">استعادة كلمة السر</h2>
            {sent ? (
              <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
                أرسلنا رابط الاستعادة لبريدك — افتحه خلال ساعة.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">اكتب بريدك وهنبعتلك رابط التغيير.</p>
                {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <form action={requestResetAction} className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input id="email" name="email" type="email" required dir="ltr" className="mt-1" />
                  </div>
                  <Button type="submit" className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
                    إرسال الرابط
                  </Button>
                </form>
              </>
            )}
            <p className="mt-4 text-sm">
              <Link href="/login" className="underline">رجوع للدخول</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
