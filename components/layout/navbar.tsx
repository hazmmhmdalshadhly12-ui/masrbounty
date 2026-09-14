import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export interface NavbarLink {
  href: string;
  label: string;
}

interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  links?: NavbarLink[];
}

const defaultLinks: NavbarLink[] = [
  { href: '/programs', label: 'Programs' },
  { href: '/researchers', label: 'Researchers' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

function Navbar({ links = defaultLinks, className, ...props }: NavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
      {...props}
    >
      <div className="container flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
            <ShieldCheck className="h-4 w-4" />
          </span>
          MasrBounty
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            Log in
          </Link>
          <Link href="/register" className={cn(buttonVariants({ size: 'sm' }))}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

export { Navbar };
export type { NavbarProps };
