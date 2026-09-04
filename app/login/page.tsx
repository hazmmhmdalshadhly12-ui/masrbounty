import Link from 'next/link';
import { ShieldCheck, Bug, Wallet, Trophy, type LucideIcon } from 'lucide-react';
import { LoginForm } from '@/components/forms/login-form';
import { Card, CardContent } from '@/components/ui/card';

const perks: [LucideIcon, string][] = [
  [Bug, 'تقارير منهجية بأرقام تتبع فريدة'],
  [Wallet, 'مكافآت تُقيّد في محفظتك بشفافية'],
  [Trophy, 'سمعة مهنية مبنية على نتائج موثقة'],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
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
              مرحبًا بعودتك.
              <br />
              <span className="text-slate-400">عملك ينتظرك.</span>
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
            {ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{ok}</p>}
            <LoginForm />
            <p className="mt-4 text-center text-sm">
              <Link href="/forgot-password" className="text-muted-foreground underline">
                نسيت كلمة السر؟
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
