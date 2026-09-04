import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

const cols = [
  { title: 'المنصة', links: [['البرامج', '/programs'], ['الشركات', '/companies'], ['الباحثون', '/researchers'], ['المتصدرين', '/leaderboard']] },
  { title: 'الدعم', links: [['من نحن', '/about'], ['الأسئلة الشائعة', '/faq'], ['الأمان', '/security'], ['البحث', '/search']] },
  { title: 'حسابي', links: [['دخول', '/login'], ['حساب جديد', '/register'], ['لوحتي', '/dashboard'], ['قاعة المشاهير', '/hall-of-fame']] },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#0a1628] text-slate-300">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-[#0a1628]">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-extrabold text-white">
              Masr<span className="text-amber-400">Bounty</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            أول منصة Bug Bounty مصرية — تربط الباحثين الأمنيين بالشركات عبر اختبارات مصرح بها فقط.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="mb-4 font-bold text-white">{c.title}</h4>
            <ul className="space-y-2 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href + label}>
                  <Link href={href} className="text-slate-400 transition-colors hover:text-amber-400">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 md:flex-row">
          <p>MasrBounty © {new Date().getFullYear()} — صُنع في مصر 🇪🇬</p>
          <p>Authorized security testing only — أي اختبار خارج النطاق ممنوع</p>
        </div>
      </div>
    </footer>
  );
}
