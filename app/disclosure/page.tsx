import { PageHero } from '@/components/layout/page-hero';

const include = [
  'وصف واضح للثغرة والأثر الأمني المحتمل (سرية / سلامة / توافر)',
  'خطوات إعادة الإنتاج بالتفصيل: الروابط، الطلبات، والمدخلات المستخدمة',
  'لقطات شاشة أو مقطع فيديو يوضح الاستغلال دون كشف بيانات حقيقية',
  'تقييم الخطورة المقترح (CVSS إن أمكن) والبيئة المستخدمة للاختبار',
  'بيانات التواصل للمتابعة واسم الشهرة المطلوب في قاعة المشاهير',
];

const rules = [
  'اختبر على حساباتك الخاصة فقط — ممنوع الوصول لبيانات مستخدمين آخرين أو تعديلها أو حذفها',
  'لا تنفذ هجمات حجب الخدمة أو إرسال رسائل مزعجة أو فحص آلي مكثف يضر بالخدمة',
  'توقف فورًا وأبلغ عند الوصول لبيانات حساسة — لا تحتفظ بها ولا تشاركها',
  'امنحنا مهلة معالجة 90 يومًا قبل أي إفصاح علني منسق',
  'ممنوع الهندسة الاجتماعية أو التصيد أو الوصول المادي لمقرات الشركة',
];

const timeline = [
  'تأكيد الاستلام خلال 48 ساعة من الإبلاغ',
  'التقييم الأولي وتحديد الخطورة خلال 5 أيام عمل',
  'الإصلاح حسب الخطورة: الحرجة خلال 15 يومًا، العالية خلال 30 يومًا',
  'المكافأة والاعتراف العلني بعد التأكد من الإصلاح — بإذنك',
];

export default function Disclosure() {
  return (
    <main dir="rtl" lang="ar">
      <PageHero
        kicker="إفصاح مسؤول"
        title="سياسة الإفصاح عن الثغرات"
        desc="ساعدنا على حماية الباحثين والشركات: أبلغ بمسؤولية، وسنتعامل مع بلاغك بسرية وجدية ونكافئك بعد الإصلاح."
      />
      <section className="container max-w-3xl space-y-8 py-10">
        <div>
          <h2 className="font-bold">كيف تُبلغ</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            راسلنا على <span dir="ltr" className="font-mono">security@masrbounty.com</span> بعنوان يبدأ بـ
            <span className="font-mono"> [Disclosure] </span>
            ولا تفتح Issue عامًا أو تنشر تفاصيل الثغرة قبل التنسيق معنا. إن تعذر البريد، استخدم نموذج الدعم مع
            الإشارة إلى أن البلاغ أمني.
          </p>
        </div>
        <div>
          <h2 className="font-bold">ماذا يتضمن البلاغ الجيد</h2>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted-foreground">
            {include.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-bold">قواعد الاشتباك والملاذ الآمن</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            نلتزم بعدم اتخاذ أي إجراء قانوني ضد من يلتزم بهذه القواعد بحسن نية ويتوقف عند أول دليل على الوصول
            غير المقصود.
          </p>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted-foreground">
            {rules.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-bold">الجدول الزمني للمعالجة</h2>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted-foreground">
            {timeline.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-bold">المكافآت والاعتراف</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            تُقدَّر المكافأة حسب الخطورة والأثر وجودة التقرير بعد التحقق والإصلاح، مع إدراج اسم الشهرة في قاعة
            المشاهير بموافقتك. البلاغات المكررة أو خارج النطاق أو المولدة آليًا دون تحقق يدوي غير مؤهلة للمكافأة.
            الملف المرجعي للآلات: <a href="/.well-known/security.txt" className="underline" dir="ltr">security.txt</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
