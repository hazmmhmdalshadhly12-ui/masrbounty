import { z } from 'zod';

export const basicSchema = z.object({
  name: z.string().trim().min(3, 'الاسم مطلوب (٣ أحرف على الأقل)').max(120),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .refine((v) => !v || /^[a-z0-9\u0600-\u06FF]+(?:-[a-z0-9\u0600-\u06FF]+)*$/.test(v), {
      message: 'المعرّف غير صالح — استخدم أحرفًا وأرقامًا وشرطات فقط',
    }),
  logo_url: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().url().safeParse(v).success, { message: 'رابط الشعار غير صالح' }),
  description: z.string().trim().min(50, 'الوصف يجب أن يكون ٥٠ حرفًا على الأقل').max(10000),
  website: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().url().safeParse(v).success, { message: 'رابط الموقع غير صالح' }),
  contact_email: z.string().trim().email('البريد الإلكتروني غير صالح').max(255),
});

export const assetSchema = z.object({
  id: z.string(),
  type: z.enum(['web', 'api', 'mobile', 'network', 'other']),
  value: z.string().trim().min(2, 'قيمة الأصل مطلوبة').max(500),
  description: z.string().max(2000).optional().default(''),
});

export const scopeSchema = z.object({
  assets: z.array(assetSchema).min(1, 'أضف أصلًا واحدًا على الأقل').refine((arr) => arr.every((a) => a.value.trim().length >= 2), {
    message: 'كل الأصول يجب أن تحتوي على قيمة صحيحة',
  }),
  out_of_scope: z.string().max(10000).optional().default(''),
});

export const rulesSchema = z.object({
  testingRules: z.string().trim().min(10, 'قواعد الاختبار مطلوبة (١٠ أحرف على الأقل)').max(10000),
  safeHarbor: z.string().trim().min(10, 'نص الملاذ الآمن مطلوب').max(10000),
  prohibited: z.string().trim().min(5, 'المحظورات مطلوبة').max(10000),
  rateLimits: z.string().trim().min(5, 'حدود المعدل مطلوبة').max(5000),
  disclosurePolicy: z.string().max(10000).optional().default(''),
});

export const bountyPolicySchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  min_amount: z.number().min(0, 'المبلغ يجب أن يكون ≥ ٠'),
  max_amount: z.number().min(0),
}).refine((v) => v.max_amount >= v.min_amount, { message: 'الحد الأقصى يجب أن يكون ≥ الحد الأدنى', path: ['max_amount'] });

export const rewardsSchema = z.object({
  bountyType: z.enum(['fixed', 'range']),
  policies: z.array(bountyPolicySchema).min(1, 'أضف سياسة مكافأة واحدة على الأقل').length(4, 'يجب تحديد ٤ مستويات للخطورة'),
}).superRefine((data, ctx) => {
  if (data.bountyType === 'fixed') {
    for (let i = 0; i < data.policies.length; i++) {
      const p = data.policies[i] as { min_amount: number; max_amount: number };
      if (p.min_amount !== p.max_amount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'في النوع الثابت يجب أن يتساوى الحد الأدنى والأقصى', path: ['policies', i, 'max_amount'] });
      }
    }
  }
});

export const slaSchema = z.object({
  response_hours: z.number().int().min(1, 'وقت الاستجابة مطلوب').max(720),
  triage_hours: z.number().int().min(1).max(720),
  resolution_hours: z.number().int().min(1).max(2160),
});

export const disclosureSchema = z.object({
  visibility: z.enum(['public', 'private']),
  disclosureMode: z.enum(['private', 'coordinated', 'public']),
});

export const verificationSchema = z.object({
  domain: z.string().trim().min(3, 'الدومين مطلوب').regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'صيغة الدومين غير صحيحة (مثال: example.com)'),
  filePath: z.string().trim().min(1).default('/.well-known/masrbounty-verification.txt'),
  sentence: z.string().trim().min(10),
  verified: z.boolean().refine((v) => v === true, { message: 'يجب إثبات ملكية الدومين قبل المتابعة — ضع الملف ثم اضغط تحقق' }),
  token: z.string().trim().min(8),
});

export const wizardSchemas = {
  1: basicSchema,
  2: verificationSchema,
  3: scopeSchema,
  4: rulesSchema,
  5: rewardsSchema,
  6: slaSchema,
  7: disclosureSchema,
} as const;

export function validateStep(step: number, data: unknown): { ok: boolean; errors?: string[] } {
  const schema = wizardSchemas[step as keyof typeof wizardSchemas];
  if (!schema) return { ok: true };
  const res = schema.safeParse(data);
  if (res.success) return { ok: true };
  return { ok: false, errors: res.error.errors.map((e) => e.message) };
}
