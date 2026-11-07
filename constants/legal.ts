import type { LegalCategory } from '@/types/legal';

/**
 * Registry of the 12 platform policies (seeded by migration 26).
 * Slugs MUST match the seed exactly — acceptance records reference them.
 */

export interface LegalDocMeta {
  slug: string;
  title: string;
  description: string;
  category: LegalCategory;
  icon: string;
}

export const LEGAL_DOCUMENTS: LegalDocMeta[] = [
  { slug: 'terms-of-service', title: 'شروط الاستخدام', description: 'القواعد الأساسية لاستخدام المنصة', category: 'core', icon: 'doc' },
  { slug: 'privacy-policy', title: 'سياسة الخصوصية', description: 'ما نجمعه من بيانات وكيف نحميه', category: 'core', icon: 'lock' },
  { slug: 'disclaimer', title: 'إخلاء المسؤولية', description: 'حدود مسؤولية المنصة كوسيط تقني', category: 'core', icon: 'shield' },
  { slug: 'responsible-disclosure', title: 'الإفصاح المسؤول', description: 'كيف تبلّغ عن ثغرة بشكل مسؤول', category: 'bounty', icon: 'megaphone' },
  { slug: 'bug-bounty-rules', title: 'قواعد مكافآت الثغرات', description: 'قواعد عامة لكل برامج المكافآت', category: 'bounty', icon: 'rules' },
  { slug: 'company-agreement', title: 'اتفاقية الشركات', description: 'التزامات الشركة عند نشر برنامج', category: 'company', icon: 'building' },
  { slug: 'researcher-agreement', title: 'اتفاقية الباحثين', description: 'التزامات الباحث الأمني', category: 'researcher', icon: 'search' },
  { slug: 'rewards-payment', title: 'المكافآت والمدفوعات', description: 'المحفظة والإيداعات والعمولة والصرف', category: 'bounty', icon: 'wallet' },
  { slug: 'dispute-resolution', title: 'حل النزاعات', description: 'كيف نعالج الخلافات', category: 'core', icon: 'scale' },
  { slug: 'suspension-termination', title: 'الإيقاف وإنهاء الحساب', description: 'متى نعلّق الحسابات وكيف تعمل الاستئنافات', category: 'core', icon: 'pause' },
  { slug: 'prohibited-activities', title: 'الأنشطة المحظورة', description: 'سلوكيات تؤدي إلى إلغاء الأهلية', category: 'bounty', icon: 'ban' },
  { slug: 'data-retention', title: 'الاحتفاظ بالبيانات والحذف', description: 'مدد الاحتفاظ وكيفية حذف حسابك', category: 'data', icon: 'trash' },
];

/** Docs every user must accept at registration (versions recorded). */
export const REGISTRATION_AGREEMENT_SLUGS = ['terms-of-service', 'privacy-policy', 'responsible-disclosure'] as const;

/** The 5 mandatory checks of the registration Legal & Security stage. */
export interface RegistrationCheck {
  id: string;
  label: string;
  /** Optional policy link rendered after the label. */
  linkSlug?: string;
}

export const REGISTRATION_CHECKS: RegistrationCheck[] = [
  { id: 'terms', label: 'أوافق على شروط الاستخدام', linkSlug: 'terms-of-service' },
  { id: 'age', label: 'أؤكد أن عمري 18 سنة أو أكثر' },
  { id: 'privacy', label: 'أوافق على سياسة الخصوصية', linkSlug: 'privacy-policy' },
  { id: 'authorized', label: 'أُقر بأنني سأجري اختبارات أمنية مصرّح بها فقط عبر برامج معلنة على المنصة', linkSlug: 'responsible-disclosure' },
  { id: 'scope', label: 'أتعهد بعدم اختبار أي أنظمة خارج نطاق البرامج المصرّح بها', linkSlug: 'prohibited-activities' },
];

/** Re-acceptance page uses the same three policy docs + age gate. */
export const REACCEPTANCE_CHECKS: RegistrationCheck[] = [
  { id: 'terms', label: 'أوافق على شروط الاستخدام (الإصدار الجديد)', linkSlug: 'terms-of-service' },
  { id: 'age', label: 'أؤكد أن عمري 18 سنة أو أكثر' },
  { id: 'privacy', label: 'أوافق على سياسة الخصوصية (الإصدار الجديد)', linkSlug: 'privacy-policy' },
  { id: 'authorized', label: 'أُقر بأنني سأجري اختبارات أمنية مصرّح بها فقط', linkSlug: 'responsible-disclosure' },
  { id: 'scope', label: 'أتعهد بعدم اختبار أي أنظمة خارج نطاق البرامج المصرّح بها', linkSlug: 'prohibited-activities' },
];

/** Rendered on EVERY legal page — the platform never presents policy text as legal advice. */
export const LEGAL_WARNING_AR =
  'تنبيه: هذه الوثيقة لم تتم مراجعتها بعد من قبل محامٍ مرخّص في مصر ولا تُعد استشارة قانونية — صياغة مبسّطة لقواعد المنصة.';

export const CATEGORIES_AR: Record<LegalCategory, string> = {
  core: 'الأساسيات',
  bounty: 'المكافآت',
  company: 'الشركات',
  researcher: 'الباحثون',
  data: 'البيانات',
};

export function legalDocBySlug(slug: string): LegalDocMeta | undefined {
  return LEGAL_DOCUMENTS.find((d) => d.slug === slug);
}
