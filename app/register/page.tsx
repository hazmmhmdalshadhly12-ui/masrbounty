import Link from 'next/link';
import { ShieldCheck, UserCheck, Building2, Zap } from 'lucide-react';
import { registerAction } from '@/features/auth/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
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
              انضم إلى المنصة.
              <br />
              <span className="text-slate-400">باحثًا كنت أو جهة.</span>
            </h1>
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4">
                <UserCheck className="h-5 w-5 shrink-0 text-slate-300" />
                <p className="text-sm text-slate-200"><b>للباحثين:</b> تقارير موثقة ومستحقات وسجل مهني</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4">
                <Building2 className="h-5 w-5 shrink-0 text-slate-300" />
                <p className="text-sm text-slate-200"><b>للشركات:</b> برامج مصممة حسب نطاق عملك وسياساتك</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4">
                <Zap className="h-5 w-5 shrink-0 text-slate-300" />
                <p className="text-sm text-slate-200"><b>بدون تكلفة مسبقة</b> للتسجيل وبدء العمل</p>
              </div>
            </div>
          </div>
        </div>
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">حساب جديد مجاني</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              عندك حساب؟{' '}
              <Link href="/login" className="font-bold text-amber-600 underline">
                سجّل دخول
              </Link>
            </p>
            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <form action={registerAction} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input id="username" name="username" required minLength={3} dir="ltr" placeholder="hunter_eg" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" name="email" type="email" required dir="ltr" placeholder="you@example.com" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="password">كلمة السر (8+ أحرف)</Label>
                <Input id="password" name="password" type="password" required minLength={8} dir="ltr" placeholder="••••••••" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="role">أنا…</Label>
                <select id="role" name="role" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="researcher">
                  <option value="researcher">باحث أمني — أكتشف وأكسب</option>
                  <option value="company">شركة — عايز أحمي منتجي</option>
                </select>
              </div>
              <Button type="submit" className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
                إنشاء الحساب
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
