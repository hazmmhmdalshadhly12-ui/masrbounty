export type Locale = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';
export type Role = 'researcher' | 'company' | 'moderator' | 'admin';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface PageProps<P = Record<string, string>, S = Record<string, string | string[] | undefined>> {
  params: P;
  searchParams: S;
}

export type * from './api';
export type * from './user';
export type * from './program';
export type * from './report';
export type * from './wallet';
