import Link from 'next/link';
import { BookOpen, ShieldCheck, Wallet, Building2, MessagesSquare, Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';

const guides = [
  { icon: BookOpen, title: 'البدء كباحث', desc: 'من إنشاء الحساب حتى أول مكافأة.', href: '/faq' },
  { icon: Building2, title: 'دليل الشركات', desc: 'إنشاء برنامجك الأول وضبط النطاق والمكافآت.', href: '/faq' },
  { icon: ShieldCheck, title: 'قواعد الاختبار الآمن', desc: 'النطاق، المحظورات، وكيف تحمي حسابك.', href: '/security' },
  { icon: Wallet, title: 'المحفظة والسحب', desc: 'الأرصدة، طلبات السحب، ومدد المراجعة.', href: '/faq' },
  { icon: MessagesSquare, title: 'التواصل والدعم', desc: 'الرسائل، التعليقات، وفتح تذاكر الدعم.', href: '/contact' },
  { icon: Scale, title: 'النزاعات والاستئناف', desc: 'متى وكيف تعترض على تقييم تقريرك.', href: '/faq' },
];

export default function Help() {
  return (
    <main>
      <PageHero kicker="مركز المساعدة" title="الأدلة والشروحات" desc="كل ما تحتاجه لاستخدام المنصة باحتراف — باحثًا أو شركة." />
      <section className="container py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <Link key={g.title} href={g.href}>
              <Card className="h-full transition-colors hover:border-slate-400">
                <CardContent className="p-6">
                  <g.icon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  <h2 className="mt-4 font-bold">{g.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{g.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          لم تجد إجابتك؟ <Link href="/contact" className="underline">تواصل معنا</Link> أو راجع <Link href="/faq" className="underline">الأسئلة الشائعة</Link>.
        </p>
      </section>
    </main>
  );
}
