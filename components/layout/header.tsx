import Link from 'next/link';
import { nav } from '@/config/nav';

export function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          MasrBounty
        </Link>
        <nav className="hidden md:flex gap-6">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-muted-foreground hover:text-foreground">
              {n.ar}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2">
          <Link href="/login" className="text-sm underline">
            دخول
          </Link>
          <Link href="/register" className="text-sm underline">
            حساب جديد
          </Link>
          <Link href="/dashboard" className="text-sm underline">
            لوحتي
          </Link>
        </div>
      </div>
    </header>
  );
}
