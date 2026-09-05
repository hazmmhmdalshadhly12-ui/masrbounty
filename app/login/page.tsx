import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Bug, Wallet, Trophy, type LucideIcon } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/forms/login-form';
import { Card, CardContent } from '@/components/ui/card';
import { safeNext } from '@/lib/auth/redirect';

const perks: [LucideIcon, string][] = [
  [Bug, 'تقارير منهجية بأرقام تتبع فريدة'],
  [Wallet, 'مكافآت تُقيّد في محفظتك بشفافية'],
  [Trophy, 'سمعة مهنية مبنية على نتائج موثقة'],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; next?: string }>;
}) {
  const { error, ok, next } = await searchParams;
  // Authenticated users never see the login form (no login→dashboard loop:
  // we only redirect when a VALID session exists).
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(safeNext(next));
  const target = safeNext(next, '');

  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center gap-8 py-10 lg:grid-cols-2">
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
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">تسجيل الدخول</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              معندكش حساب؟{' '}
              <Link href={target ? `/register?next=${encodeURIComponent(target)}` : '/register'} className="font-bold text-amber-600 underline">
                اعمل واحد مجانًا
              </Link>
            </p>
            {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {ok && <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{ok}</p>}
            <LoginForm next={target} />
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
