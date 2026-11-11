import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** Optional onboarding enum values (wizard may submit '' = unanswered). */
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;

const optionalText = (max: number) =>
  z
    .literal('')
    .transform(() => undefined)
    .or(z.string().trim().max(max).optional());

const optionalUrl = (max = 300) =>
  z
    .literal('')
    .transform(() => undefined)
    .or(
      z
        .string()
        .trim()
        .url('رابط غير صالح — مثال: https://example.com')
        .max(max)
        .optional()
    );

/**
 * Base register fields as a plain object schema (no refinements) so the
 * wizard can `.pick()` per-step validation subsets. `registerSchema` adds
 * the cross-field rules on top.
 */
export const registerFields = z.object({
  username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة السر يجب أن تكون 8 أحرف على الأقل'),
  confirmPassword: z.string().min(8, 'تأكيد كلمة السر مطلوب'),
  full_name: z.string().min(2, 'الاسم الكامل مطلوب').max(100, 'الاسم الكامل يجب ألا يتجاوز 100 حرف'),
  phone: z.string().regex(/^01[0-9]{9}$/, 'رقم الهاتف يجب أن يكون 11 رقمًا يبدأ بـ 01'),
  role: z.enum(['researcher', 'company', 'member']),

  // ── Onboarding answers (registration wizard, step 2) ──────────────
  // Researcher
  experience_level: z.enum(EXPERIENCE_LEVELS).optional().or(z.literal('').transform(() => undefined)),
  skills: optionalText(400), // comma-separated; parsed by parseSkills()
  github: optionalUrl(),
  // Company (company_name enforced by refine below when role=company)
  company_name: optionalText(120),
  company_website: optionalUrl(),
  company_size: z.enum(COMPANY_SIZES).optional().or(z.literal('').transform(() => undefined)),
  company_description: optionalText(1000),
});

export const registerSchema = registerFields
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا السر غير متطابقتين',
    path: ['confirmPassword'],
  })
  .refine((d) => d.role !== 'company' || (d.company_name ?? '').length >= 2, {
    message: 'اسم الشركة مطلوب (حرفين على الأقل)',
    path: ['company_name'],
  });

/** Step-1 (account) validation subset. */
export const registerAccountStep = registerFields
  .pick({ username: true, email: true, password: true, confirmPassword: true, full_name: true, phone: true, role: true })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا السر غير متطابقتين',
    path: ['confirmPassword'],
  });

/** Step-2 (role-specific onboarding) validation subsets. */
export const registerResearcherStep = registerFields.pick({
  experience_level: true,
  skills: true,
  github: true,
});

export const registerCompanyStep = registerFields.pick({
  company_name: true,
  company_website: true,
  company_size: true,
  company_description: true,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
