import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { nav } from '@/config/nav';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">
            MasrBounty
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {n.ar}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              تسجيل الدخول
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-slate-900 font-bold text-white hover:bg-slate-700 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
              إنشاء حساب
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
