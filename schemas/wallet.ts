import { z } from 'zod';

export const payoutSchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
  payment_method_id: z.string().uuid(),
});

export const awardSchema = z.object({
  report_id: z.string().uuid(),
  amount: z.coerce.number().nonnegative().max(1000000),
});

export const depositSchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
  method: z.enum(['vodafone_cash', 'instapay', 'bank', 'other']),
  reference: z.string().trim().min(4, 'مرجع التحويل مطلوب (٤ أحرف على الأقل)').max(120),
  sender_name: z.string().trim().max(120).optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const adjustSchema = z.object({
  subject: z.enum(['researcher', 'company']),
  id: z.string().uuid(),
  amount: z.coerce.number().refine((n) => n !== 0, 'المبلغ يجب ألا يكون صفرًا'),
  note: z.string().trim().min(3, 'سبب التسوية مطلوب (٣ أحرف على الأقل)').max(300),
});

export type PayoutInput = z.infer<typeof payoutSchema>;
export type AwardInput = z.infer<typeof awardSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type AdjustInput = z.infer<typeof adjustSchema>;
