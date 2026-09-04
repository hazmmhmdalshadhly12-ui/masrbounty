import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { nav } from '@/config/nav';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0a1628]/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-[#0a1628]">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">
            Masr<span className="text-amber-400">Bounty</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-slate-300 transition-colors hover:text-amber-400">
              {n.ar}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-slate-200 hover:text-white">
              دخول
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
              ابدأ الآن
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
