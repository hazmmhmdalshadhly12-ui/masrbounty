import { z } from 'zod';

export const disputeSchema = z.object({
  report_id: z.string().uuid(),
  reason: z.string().trim().min(10).max(5000),
});

export type DisputeInput = z.infer<typeof disputeSchema>;
