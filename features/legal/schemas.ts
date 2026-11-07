import { z } from 'zod';

/**
 * The Legal & Security Agreement stage — ALL five checks are mandatory.
 * The schema fails unless every flag is exactly true.
 */
export const legalConsentSchema = z
  .object({
    terms: z.boolean(),
    age: z.boolean(),
    privacy: z.boolean(),
    authorized: z.boolean(),
    scope: z.boolean(),
    context: z.enum(['registration', 'reacceptance', 'update']),
  })
  .refine((v) => v.terms && v.age && v.privacy && v.authorized && v.scope, {
    message: 'يجب الموافقة على جميع البنود الخمسة قبل إكمال التسجيل',
  });

export type LegalConsentInput = z.infer<typeof legalConsentSchema>;

/** Registration wizard step 3 — the five mandatory checks (no context field). */
export const registerAgreementStep = z
  .object({
    terms: z.boolean(),
    age: z.boolean(),
    privacy: z.boolean(),
    authorized: z.boolean(),
    scope: z.boolean(),
  })
  .refine((v) => v.terms && v.age && v.privacy && v.authorized && v.scope, {
    message: 'يجب الموافقة على جميع البنود الخمسة',
  });

/** Legal admin: create/edit a draft version. */
export const legalDraftSchema = z.object({
  document_slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/),
  content_md: z.string().trim().min(50, 'المحتوى قصير جدًا (٥٠ حرف على الأقل)').max(200000),
  change_summary_ar: z.string().trim().max(500).optional().or(z.literal('')),
});
export type LegalDraftInput = z.infer<typeof legalDraftSchema>;

export const legalPublishSchema = z.object({
  document_slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/),
  version: z.coerce.number().int().positive(),
  requires_reacceptance: z.boolean().optional(),
});
export type LegalPublishInput = z.infer<typeof legalPublishSchema>;
