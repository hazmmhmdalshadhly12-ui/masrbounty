export interface NavItem {
  href: string;
  ar: string;
  en: string;
}

export const nav: NavItem[] = [
  { href: '/programs', ar: 'البرامج', en: 'Programs' },
  { href: '/researchers', ar: 'الباحثون', en: 'Researchers' },
  { href: '/companies', ar: 'الشركات', en: 'Companies' },
  { href: '/leaderboard', ar: 'المتصدرين', en: 'Leaderboard' },
  { href: '/hall-of-fame', ar: 'المشاهير', en: 'Hall of Fame' },
  { href: '/blog', ar: 'المدونة', en: 'Blog' },
  { href: '/help', ar: 'المساعدة', en: 'Help' },
  { href: '/faq', ar: 'الأسئلة الشائعة', en: 'FAQ' },
  { href: '/about', ar: 'من نحن', en: 'About' },
];
