import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/layout/notification-bell';
import { MobileNav } from '@/components/layout/mobile-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { HeaderNav } from '@/components/layout/header-nav';

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
    <header className="sticky top-0 z-50 w-full border-b bg-background/85 shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MobileNav authed={!!username} />
          <Link
            href="/"
            className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="MasrBounty الرئيسية"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-amber-400 shadow-card transition-transform duration-200 group-hover:scale-105 dark:bg-amber-400 dark:text-navy-900">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="text-[17px] font-black tracking-tight">
              Masr<span className="text-primary">Bounty</span>
            </span>
          </Link>
        </div>
        <HeaderNav />
        <div className="flex items-center gap-1.5">
          {username ? (
            <>
              <NotificationBell />
              <UserMenu username={username} email={email} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">تسجيل الدخول</Link>
              </Button>
              <Button asChild size="sm" className="font-bold">
                <Link href="/register">انضم الآن</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
