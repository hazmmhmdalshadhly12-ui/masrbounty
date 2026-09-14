import type { Locale } from '@/types/index';
import { nav, type NavItem } from './nav';

export interface SiteConfig {
  name: string;
  shortName: string;
  description: string;
  descriptionEn: string;
  url: string;
  locale: Locale;
  locales: readonly Locale[];
  contactEmail: string;
  nav: readonly NavItem[];
}

function normalizeUrl(raw: string | undefined, fallback: string): string {
  const value = (raw ?? fallback).trim();
  return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value;
}

export const site: SiteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'MasrBounty',
  shortName: 'MasrBounty',
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() || 'منصة مصر لمكافآت الثغرات — اختبار أمني مصرّح به فقط',
  descriptionEn: 'Egyptian Bug Bounty Platform — Authorized security testing only',
  url: normalizeUrl(process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000'),
  locale: 'ar',
  locales: ['ar', 'en'],
  contactEmail: 'support@masrbounty.com',
  nav,
};

export const siteConfig = site;
export const DEFAULT_LOCALE: Locale = 'ar';
export const SITE_URL = site.url;
export const SITE_NAME = site.name;
