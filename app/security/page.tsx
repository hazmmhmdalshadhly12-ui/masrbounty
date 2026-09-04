import { PageHero } from '@/components/layout/page-hero';

const scope = ['نطاق منصة masrbounty.online نفسه وواجهات API الخاصة به', 'أنظمة المصادقة وإدارة الجلسات', 'آليات التفويض وسياسات الوصول للتقارير والمحفظة'];
const out = ['الهندسة الاجتماعية لموظفي المنصة أو مستخدميها', 'هجمات الحرمان من الخدمة', 'ثغرات خدمات الطرف الثالث (Supabase/Cloudflare) — بلّغ مزودها مباشرة', 'مخرجات أدوات الفحص الآلي دون تحقق يدوي'];

export default function Security() {
  return (
    <main>
      <PageHero kicker="الأمن أولًا" title="سياسة الإفصاح المسؤول" desc="اكتشفت ثغرة في المنصة نفسها؟ بلّغنا بمسؤولية وسنكافئك بعد التحقق والإصلاح." />
      <section className="container max-w-3xl py-10 space-y-8">
        <div>
          <h2 className="font-bold">كيف تُبلغ</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            راسلنا على <span dir="ltr" className="font-mono">security@masrbounty.com</span> متضمنًا: وصف الثغرة، خطوات الاستنساخ،
            الأثر المحتمل، وبيئة الاختبار. لا تفتح Issue عامًا للثغرات الأمنية أبدًا.
          </p>
        </div>
        <div>
          <h2 className="font-bold">النطاق المشمول</h2>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted-foreground">
            {scope.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-bold">خارج النطاق</h2>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted-foreground">
            {out.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-bold">وعدنا لك</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            تأكيد الاستلام خلال 48 ساعة، وتقييم أولي خلال 5 أيام عمل. لا إجراءات قانونية ضد من يلتزم بهذه السياسة،
            مع اعتراف علني في قاعة المشاهير ومكافأة حسب الخطورة بعد الإصلاح. ملف الآلة: <a href="/.well-known/security.txt" className="underline" dir="ltr">security.txt</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
