export type Role='researcher'|'company'|'moderator'|'admin';
export type Locale='ar'|'en';
export interface PageProps<P={} ,S={}>{params:P;searchParams:S}
