import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { nav } from '@/config/nav';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/layout/notification-bell';
import { MobileNav } from '@/components/layout/mobile-nav';
import { UserMenu } from '@/components/layout/user-menu';

const resources = [
  { href: '/blog', ar: 'المدونة' },
  { href: '/help', ar: 'المساعدة' },
  { href: '/about', ar: 'من نحن' },
];

export async function Header() {
  let username: string | null = null;
  let email: string | undefined;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      email = data.user.email ?? undefined;
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', data.user.id).single();
      username = profile?.username ?? data.user.email?.split('@')[0] ?? null;
    }
  } catch {
    username = null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MobileNav authed={!!username} />
          <Link href="/" className="flex items-center gap-2.5" aria-label="MasrBounty الرئيسية">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="text-[17px] font-extrabold tracking-tight">MasrBounty</span>
          </Link>
        </div>
        <nav className="hidden items-center gap-6 md:flex" aria-label="التنقل الرئيسي">
          <Link href="/programs" className="text-sm text-muted-foreground transition-colors hover:text-foreground">البرامج</Link>
          <Link href="/researchers" className="text-sm text-muted-foreground transition-colors hover:text-foreground">الباحثون</Link>
          <Link href="/companies" className="text-sm text-muted-foreground transition-colors hover:text-foreground">الشركات</Link>
          <Link href="/leaderboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">المتصدرين</Link>
          <div className="group relative">
            <button type="button" className="text-sm text-muted-foreground transition-colors hover:text-foreground" aria-haspopup="true">
              الموارد
            </button>
            <div className="invisible absolute right-0 top-full z-50 w-44 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="overflow-hidden rounded-xl border bg-popover shadow-xl">
                {[...nav.filter((n) => !['/programs', '/researchers', '/companies', '/leaderboard'].includes(n.href)), ...resources].map((n) => (
                  <Link key={n.href} href={n.href} className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                    {n.ar}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center gap-1.5">
          {username ? (
            <>
              <NotificationBell />
              <UserMenu username={username} email={email} />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">تسجيل الدخول</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-slate-900 font-bold text-white hover:bg-slate-700 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
                  انضم الآن
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
