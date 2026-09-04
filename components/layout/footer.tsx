import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

const cols = [
  { title: 'المنصة', links: [['البرامج', '/programs'], ['الشركات', '/companies'], ['الباحثون', '/researchers'], ['المتصدرين', '/leaderboard']] },
  { title: 'الموارد', links: [['من نحن', '/about'], ['الأسئلة الشائعة', '/faq'], ['الأمان', '/security'], ['البحث', '/search']] },
  { title: 'الحساب', links: [['تسجيل الدخول', '/login'], ['إنشاء حساب', '/register'], ['لوحة التحكم', '/dashboard'], ['قاعة المشاهير', '/hall-of-fame']] },
];

export function Footer() {
  return (
    <footer className="border-t bg-slate-50 dark:bg-slate-950">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="text-[17px] font-extrabold tracking-tight">MasrBounty</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            منصة مصرية لبرامج مكافآت الثغرات. اختبارات مصرح بها فقط، ضمن نطاق معلن وقواعد واضحة.
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h4 className="text-sm font-bold">{c.title}</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href + label}>
                  <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground md:flex-row">
          <p>MasrBounty © {new Date().getFullYear()} — جميع الحقوق محفوظة</p>
          <p>يُحظر أي اختبار خارج نطاق البرامج المعتمدة</p>
        </div>
      </div>
    </footer>
  );
}
