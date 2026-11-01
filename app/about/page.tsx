import Link from 'next/link';
import { ShieldCheck, Building2, Bug } from 'lucide-react';
import { PageHero } from '@/components/layout/page-hero';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'عن المنصة — MasrBounty',
  description: 'MasrBounty منصة مصرية لمكافآت الثغرات تربط الباحثين الأمنيين بالشركات عبر برامج اختبار مصرّح بها ومنظمة.',
};

export default function About() {
  return (
    <div>
      <PageHero
        kicker="عن المنصة"
        title="اختبارات مصرّح بها، مكافآت عادلة، شفافية كاملة"
        desc="MasrBounty منصة مصرية لمكافآت الثغرات (Bug Bounty) تربط الباحثين الأمنيين بالشركات عبر برامج اختبار منظمة بنطاق وقواعد ومكافآت واضحة."
      />
      <section className="container max-w-3xl space-y-4 py-10">
        <Card>
          <CardContent className="p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
              <Bug className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-lg font-black">للباحثين</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              قدّم تقارير ثغرات على برامج منشورة بنطاق معلن، وتابع حالة تقريرك خطوة بخطوة (استلام، فرز، معالجة، مكافأة).
              اكسب المكافآت في محفظتك، وابنِ سمعتك من نقاط تُحسب تلقائيًا من التقارير المقبولة، واجمع شارات الإنجازات،
              وتنافس في لوحة المتصدرين وقاعة المشاهير بموافقتك.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
              <Building2 className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-lg font-black">للشركات</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              انشر برنامجًا عامًا أو خاصًا (بالدعوة) بنطاق وقواعد وجدول مكافآت لكل درجة خطورة، وثّق نطاقك عبر DNS،
              ودرّق التقارير الواردة بفريق بأدوار وصلاحيات محددة (مالك، مسؤول، فرز، مشاهد)، وادفع المكافآت عبر مسار
              مالي موثق بضمان المنصة وسجلات تدقيق كاملة.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-lg font-black">قاعدة الذهب: الاختبار المصرّح فقط</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              يُسمح بالاختبار داخل نطاق البرنامج المعلن فقط. أي مسح عشوائي أو هجوم على أنظمة خارج النطاق أو دون
              إذن مسبق ممنوع ويُعد مخالفة تؤدي لإيقاف الحساب. النزاعات تُحسم عبر مسار مراجعة موثق يضمن حق الطرفين.
            </p>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          جاهز للبدء؟ <Link href="/register" className="font-bold text-blue-700 hover:underline dark:text-blue-400">أنشئ حسابك</Link> أو
          {' '}<Link href="/programs" className="font-bold text-blue-700 hover:underline dark:text-blue-400">استعرض البرامج المتاحة</Link>.
        </p>
      </section>
    </div>
  );
}
