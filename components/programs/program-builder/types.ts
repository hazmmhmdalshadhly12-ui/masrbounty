// Wizard types — Arabic RTL, strict TypeScript
export type AssetType = 'web' | 'api' | 'mobile' | 'network' | 'other';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Visibility = 'public' | 'private';
export type DisclosureMode = 'private' | 'coordinated' | 'public';
export type BountyType = 'fixed' | 'range';

export interface WizardAsset {
  id: string;
  type: AssetType;
  value: string;
  description: string;
}

export interface WizardBountyPolicy {
  severity: Severity;
  min_amount: number;
  max_amount: number;
}

export interface WizardData {
  basic: {
    name: string;
    slug: string;
    logo_url: string;
    description: string;
    website: string;
    contact_email: string;
  };
  verification: {
    domain: string;
    filePath: string;
    sentence: string;
    verified: boolean;
    token: string;
  };
  scope: {
    assets: WizardAsset[];
    out_of_scope: string;
  };
  rules: {
    testingRules: string;
    safeHarbor: string;
    prohibited: string;
    rateLimits: string;
    disclosurePolicy: string;
  };
  rewards: {
    bountyType: BountyType;
    policies: WizardBountyPolicy[];
  };
  sla: {
    response_hours: number;
    triage_hours: number;
    resolution_hours: number;
  };
  disclosure: {
    visibility: Visibility;
    disclosureMode: DisclosureMode;
  };
}

export const TOTAL_STEPS = 9;

export const STEP_LABELS_AR: Record<number, { title: string; desc: string }> = {
  1: { title: 'البيانات الأساسية', desc: 'اسم وشعار ووصف البرنامج' },
  2: { title: 'إثبات الملكية', desc: 'ملف التحقق على موقعك' },
  3: { title: 'النطاق', desc: 'الأصول والنطاقات المستهدفة' },
  4: { title: 'القواعد', desc: 'قواعد الاختبار والملاذ الآمن' },
  5: { title: 'المكافآت', desc: 'مبالغ المكافآت حسب الخطورة' },
  6: { title: 'اتفاقية الخدمة', desc: 'أزمنة الاستجابة والفرز والمعالجة' },
  7: { title: 'الإفصاح', desc: 'الخصوصية وسياسة الإفصاح' },
  8: { title: 'المعاينة', desc: 'كيف يرى الباحثون برنامجك' },
  9: { title: 'النشر', desc: 'المراجعة والنشر' },
};

export function getDefaultWizardData(): WizardData {
  return {
    basic: { name: '', slug: '', logo_url: '', description: '', website: '', contact_email: '' },
    verification: { domain: '', filePath: '/.well-known/masrbounty-verification.txt', sentence: '', verified: false, token: '' },
    scope: {
      assets: [{ id: '1', type: 'web', value: '', description: '' }],
      out_of_scope: '',
    },
    rules: { testingRules: '', safeHarbor: '', prohibited: '', rateLimits: '', disclosurePolicy: '' },
    rewards: {
      bountyType: 'range',
      policies: [
        { severity: 'critical', min_amount: 1000, max_amount: 5000 },
        { severity: 'high', min_amount: 500, max_amount: 1500 },
        { severity: 'medium', min_amount: 100, max_amount: 500 },
        { severity: 'low', min_amount: 25, max_amount: 100 },
      ],
    },
    sla: { response_hours: 48, triage_hours: 72, resolution_hours: 168 },
    disclosure: { visibility: 'public', disclosureMode: 'coordinated' },
  };
}
