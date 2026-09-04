'use client'
import ar from '@/constants/translations/ar.json';
import en from '@/constants/translations/en.json';
export function useT(locale:'ar'|'en'='ar'){return locale==='ar'?ar:en}
