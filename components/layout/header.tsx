import Link from 'next/link';
import { ShieldCheck, LayoutDashboard, Bell } from 'lucide-react';
import { nav } from '@/config/nav';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { createServerClient } from '@/lib/supabase/server';

export async function Header() {
  let userId: string | null = null;
  let unread = 0;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    if (userId) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      unread = count ?? 0;
    }
  } catch {
    /* public header on DB failure */
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">MasrBounty</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {n.ar}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {userId ? (
            <>
              <Link href="/dashboard/notifications" aria-label="الإشعارات" className="relative flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link href="/dashboard">
                <Button size="sm" className="bg-slate-900 font-bold text-white hover:bg-slate-700 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
                  <LayoutDashboard className="h-4 w-4" /> لوحتي
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">تسجيل الدخول</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-slate-900 font-bold text-white hover:bg-slate-700 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
                  إنشاء حساب
                </Button>
              </Link>
            </>
          )}
        </div>
        <MobileMenu loggedIn={!!userId} />
      </div>
    </header>
  );
}
