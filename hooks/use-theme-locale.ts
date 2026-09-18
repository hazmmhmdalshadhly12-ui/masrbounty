'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// السمة واللغة: حالة محلية + مزامنة مع profiles عند توفر userId
export type ThemeChoice = 'light' | 'dark' | 'system';
export type LocaleChoice = 'ar' | 'en';

function readStored(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useThemeLocale(userId?: string) {
  const [theme, setThemeState] = useState<ThemeChoice>('system');
  const [locale, setLocaleState] = useState<LocaleChoice>('ar');

  // حمّل القيم المحلية أولًا (SSR-safe)
  useEffect(() => {
    setThemeState(readStored('mb-theme', 'system') as ThemeChoice);
    setLocaleState((readStored('mb-locale', 'ar') as LocaleChoice) === 'en' ? 'en' : 'ar');
  }, []);

  // اقرأ تفضيلات الحساب من profiles عند توفر userId (RLS: المالك)
  const prefs = useQuery({
    queryKey: ['theme-locale', userId ?? 'local'],
    staleTime: 60_000,
    enabled: !!userId,
    queryFn: async (): Promise<{ theme: ThemeChoice; locale: LocaleChoice } | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('theme,locale')
        .eq('id', userId as string)
        .single();
      if (error) throw error;
      const row = (data ?? {}) as { theme?: string; locale?: string };
      return {
        theme: (row.theme as ThemeChoice) ?? 'system',
        locale: (row.locale === 'en' ? 'en' : 'ar') as LocaleChoice,
      };
    },
  });

  // طبّق تفضيلات الحساب على الحالة المحلية عند وصولها
  useEffect(() => {
    if (prefs.data) {
      setThemeState(prefs.data.theme);
      setLocaleState(prefs.data.locale);
    }
  }, [prefs.data]);

  // طبّق اللغة على <html> واحفظ محليًا + cookie للـ SSR
  useEffect(() => {
    try {
      window.localStorage.setItem('mb-theme', theme);
      window.localStorage.setItem('mb-locale', locale);
      document.cookie = `mb-locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // تجاهل
    }
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [theme, locale]);

  const setTheme = useCallback(
    async (next: ThemeChoice) => {
      setThemeState(next);
      if (!userId) return;
      try {
        const supabase = createClient();
        await supabase.from('profiles').update({ theme: next }).eq('id', userId);
      } catch {
        // فشل المزامنة — تبقى القيمة المحلية
      }
    },
    [userId],
  );

  const setLocale = useCallback(
    async (next: LocaleChoice) => {
      setLocaleState(next);
      if (!userId) return;
      try {
        const supabase = createClient();
        await supabase.from('profiles').update({ locale: next }).eq('id', userId);
      } catch {
        // فشل المزامنة — تبقى القيمة المحلية
      }
    },
    [userId],
  );

  return { theme, locale, setTheme, setLocale, prefs };
}
