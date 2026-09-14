import { z } from 'zod';

export const walletSchema = z.object({
  id: z.string().uuid().optional(),
});

export const payoutRequestSchema = z.object({
  amount: z.coerce.number().positive(),
  payment_method_id: z.string().uuid(),
});

export const paymentMethodSchema = z.object({
  type: z.enum(['bank', 'wallet', 'vodafone_cash', 'instapay', 'other']),
  label: z.string().min(2).max(100),
  details: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  is_default: z.boolean().default(false),
});

export type WalletFormInput = z.infer<typeof payoutRequestSchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
