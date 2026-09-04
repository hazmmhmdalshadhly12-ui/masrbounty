import { z } from 'zod';

export const payoutSchema = z.object({
  amount: z.number().positive(),
  payment_method_id: z.string().uuid(),
});

export const awardSchema = z.object({
  report_id: z.string().uuid(),
  amount: z.number().nonnegative(),
});

export type PayoutInput = z.infer<typeof payoutSchema>;
export type AwardInput = z.infer<typeof awardSchema>;
