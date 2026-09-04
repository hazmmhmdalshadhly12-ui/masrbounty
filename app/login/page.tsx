import Link from 'next/link';
import { ShieldCheck, Bug, Wallet, Trophy, type LucideIcon } from 'lucide-react';
import { loginAction } from '@/features/auth/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const perks: [LucideIcon, string][] = [
  [Bug, 'بلّغ عن الثغرات المصرح بها فقط'],
  [Wallet, 'اكسب مكافآت تُضاف لمحفظتك'],
  [Trophy, 'ابنِ سمعتك وادخل قاعة المشاهير'],
];

export default function LoginPage() {
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center gap-8 py-10 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden overflow-hidden rounded-3xl bg-[#0a1628] p-10 text-white lg:block">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.2),transparent_60%)]" />
          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-[#0a1628]">
              <ShieldCheck className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <h1 className="mt-6 text-3xl font-black leading-snug">
              أهلًا بعودتك يا بطل.
              <br />
              <span className="text-amber-400">الثغرات مستنياك.</span>
            </h1>
            <ul className="mt-8 space-y-4">
              {perks.map(([Icon, text]) => (
                <li key={text} className="flex items-center gap-3 text-slate-200">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-amber-400" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Form */}
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">تسجيل الدخول</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              معندكش حساب؟{' '}
              <Link href="/register" className="font-bold text-amber-600 underline">
                اعمل واحد مجانًا
              </Link>
            </p>
            <form action={loginAction} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" name="email" type="email" required dir="ltr" placeholder="you@example.com" className="mt-1" />
              </div>
              <div>
                <div className="flex justify-between">
                  <Label htmlFor="password">كلمة السر</Label>
                  <Link href="/forgot-password" className="text-xs text-muted-foreground underline">
                    نسيتها؟
                  </Link>
                </div>
                <Input id="password" name="password" type="password" required dir="ltr" placeholder="••••••••" className="mt-1" />
              </div>
              <Button type="submit" className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
                دخول
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
