import { z } from 'zod';
import { egpToMinor, MAX_MINOR, MAX_DEPOSIT_MINOR } from '@/lib/finance/money';

/**
 * Financial input schemas. Amounts arrive as EGP strings from forms and are
 * converted to INTEGER PIASTRES here — the only place conversion happens.
 */

const EGP_MINORS = ['vodafone_cash', 'instapay', 'bank', 'other'] as const;

/** EGP string -> integer piastres (rejects >2 decimals, zero, negatives). */
const minorFromEgp = (maxMinor: number) =>
  z
    .string()
    .trim()
    .min(1, 'المبلغ مطلوب')
    .transform((val, ctx) => {
      const minor = egpToMinor(val);
      if (minor === null) {
        ctx.addIssue({ code: 'custom', message: 'أدخل مبلغًا صحيحًا بالجنيه (حتى منزلتين)' });
        return z.NEVER;
      }
      if (minor > maxMinor) {
        ctx.addIssue({ code: 'custom', message: 'المبلغ يتجاوز الحد الأقصى المسموح' });
        return z.NEVER;
      }
      return minor;
    });

export const depositRequestV2Schema = z.object({
  amount_minor: minorFromEgp(MAX_DEPOSIT_MINOR),
  method: z.enum(EGP_MINORS, { message: 'اختر وسيلة التحويل' }),
  reference: z.string().trim().min(4, 'مرجع التحويل مطلوب (٤ أحرف على الأقل)').max(120),
  sender_name: z.string().trim().max(120).optional().or(z.literal('')),
  proof_url: z.union([z.literal(''), z.string().trim().url('رابط الإثبات غير صالح').max(500)]).optional(),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});
export type DepositRequestV2Input = z.infer<typeof depositRequestV2Schema>;

/** Reward approval requires an EXPLICIT confirmation flag — the server
 *  rejects the operation outright unless confirm === true. */
export const bountyRewardApprovalSchema = z.object({
  report_id: z.string().uuid(),
  amount_minor: minorFromEgp(MAX_MINOR),
  confirm: z.literal(true, { message: 'يجب تأكيد اعتماد المكافأة صراحة' }),
  idempotency_key: z.string().trim().min(8).max(120).optional(),
});
export type BountyRewardApprovalInput = z.infer<typeof bountyRewardApprovalSchema>;

export const commissionRateSchema = z.object({
  scope: z.enum(['global', 'company']),
  company_id: z.string().uuid().nullable().optional(),
  /** percent with up to 2 decimals ("20", "12.5") -> basis points */
  rate_percent: z
    .string()
    .trim()
    .min(1, 'النسبة مطلوبة')
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'النسبة بين 0 و100 (حتى منزلتين)')
    .transform((val, ctx) => {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        ctx.addIssue({ code: 'custom', message: 'النسبة بين 0 و100' });
        return z.NEVER;
      }
      return Math.round(n * 100); // basis points
    }),
  reason: z.string().trim().min(3, 'سبب التعديل مطلوب (٣ أحرف على الأقل)').max(300),
});
export type CommissionRateInput = z.infer<typeof commissionRateSchema>;

export const payoutCompleteSchema = z.object({
  payout_id: z.string().uuid(),
  proof_url: z.string().trim().url('رابط إثبات الدفع مطلوب').max(500),
  reference: z.string().trim().max(120).optional().or(z.literal('')),
});
export type PayoutCompleteInput = z.infer<typeof payoutCompleteSchema>;

export const payoutFailSchema = z.object({
  payout_id: z.string().uuid(),
  reason: z.string().trim().min(3, 'سبب الفشل مطلوب (٣ أحرف على الأقل)').max(300),
  cancel: z.boolean().optional(),
});
export type PayoutFailInput = z.infer<typeof payoutFailSchema>;

export const walletAdjustV2Schema = z.object({
  company_id: z.string().uuid(),
  /** signed EGP amount; converted to signed piastres */
  amount: z
    .string()
    .trim()
    .min(1, 'المبلغ مطلوب')
    .regex(/^-?\d{1,12}(\.\d{1,2})?$/, 'أدخل مبلغًا صحيحًا (حتى منزلتين)')
    .transform((val, ctx) => {
      const neg = val.startsWith('-');
      const minor = egpToMinor(neg ? val.slice(1) : val);
      if (minor === null) {
        ctx.addIssue({ code: 'custom', message: 'أدخل مبلغًا صحيحًا' });
        return z.NEVER;
      }
      return neg ? -minor : minor;
    }),
  note: z.string().trim().min(3, 'سبب التسوية مطلوب (٣ أحرف على الأقل)').max(300),
});
export type WalletAdjustV2Input = z.infer<typeof walletAdjustV2Schema>;
