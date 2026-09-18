'use client';

import * as React from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const LOCALES = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
] as const;

interface LanguageSwitcherProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  locale?: string;
  onChange?: (locale: string) => void;
}

function LanguageSwitcher({ locale, onChange, className, ...props }: LanguageSwitcherProps) {
  const [internal, setInternal] = React.useState('ar');
  const current = locale ?? internal;

  const toggle = () => {
    const next = current === 'ar' ? 'en' : 'ar';
    if (!locale) setInternal(next);
    onChange?.(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    try {
      document.cookie = `mb-locale=${next}; path=/; max-age=31536000; samesite=lax`;
      window.localStorage.setItem('mb-locale', next);
    } catch {
      // storage blocked
    }
  };

  const nextLabel = current === 'ar' ? 'English' : 'العربية';

  return (
    <div className={cn('inline-flex items-center', className)} {...props}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 focus-visible:ring-2"
        aria-label={`Switch language to ${nextLabel}`}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        {nextLabel}
      </Button>
    </div>
  );
}

export { LanguageSwitcher };
export type { LanguageSwitcherProps };
