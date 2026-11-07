import Link from 'next/link';
import { ShieldCheck, Twitter, Linkedin, Github, MessageCircle, Send, ArrowLeft } from 'lucide-react';
import { social } from '@/config/social';

const icons: Record<string, typeof Twitter> = {
  x: Twitter,
  linkedin: Linkedin,
  github: Github,
  discord: MessageCircle,
  telegram: Send,
};

const cols = [
  { title: 'المنصة', links: [['البرامج', '/programs'], ['الشركات', '/companies'], ['الباحثون', '/researchers'], ['المتصدرين', '/leaderboard']] },
  { title: 'الموارد', links: [['من نحن', '/about'], ['المدونة', '/blog'], ['المساعدة', '/help'], ['الأسئلة الشائعة', '/faq'], ['تواصل معنا', '/contact']] },
  { title: 'قانوني', links: [['مركز السياسات', '/legal'], ['شروط الاستخدام', '/legal/terms-of-service'], ['سياسة الخصوصية', '/legal/privacy-policy'], ['الإفصاح المسؤول', '/legal/responsible-disclosure'], ['الأنشطة المحظورة', '/legal/prohibited-activities'], ['الأمان', '/security']] },
  { title: 'الحساب', links: [['تسجيل الدخول', '/login'], ['إنشاء حساب', '/register'], ['لوحة التحكم', '/dashboard'], ['قاعة المشاهير', '/hall-of-fame'], ['الاستئناف', '/appeal']] },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.35] bg-grid-ink" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px hairline-x" />
      <div className="container relative grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-navy-900 shadow-gold">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="text-[17px] font-black tracking-tight">
              Masr<span className="text-amber-400">Bounty</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-100/80">
            منصة مصرية لبرامج مكافآت الثغرات. اختبارات مصرح بها فقط، ضمن نطاق معلن وقواعد واضحة.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-navy-900 shadow-gold transition-all duration-200 hover:bg-amber-300 hover:shadow-lift active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900"
          >
            ابدأ الآن
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="mt-6 flex gap-2">
            {social.map((s) => {
              const Icon = icons[s.key] ?? MessageCircle;
              return (
                <a
                  key={s.key}
                  href={s.href}
                  aria-label={s.label}
                  target={s.href.startsWith('http') ? '_blank' : undefined}
                  rel={s.href.startsWith('http') ? 'noreferrer noopener' : undefined}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-navy-100/80 transition-all duration-200 hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded-full bg-amber-400" />
              {c.title}
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href + label}>
                  <Link
                    href={href}
                    className="text-navy-100/70 transition-colors duration-200 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 focus-visible:ring-offset-navy-900"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="relative border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-navy-100/60 md:flex-row">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400/70" aria-hidden="true" />
            MasrBounty © {new Date().getFullYear()} — جميع الحقوق محفوظة
          </p>
          <p>يُحظر أي اختبار خارج نطاق البرامج المعتمدة</p>
        </div>
      </div>
    </footer>
  );
}
