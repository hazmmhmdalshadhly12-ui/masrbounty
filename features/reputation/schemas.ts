import { z } from 'zod';

export const reputationSchema = z.object({
  id: z.string().uuid().optional(),
});

export const reputationQuerySchema = z.object({
  researcher_id: z.string().uuid(),
});

export type ReputationInput = z.infer<typeof reputationSchema>;
export type ReputationQuery = z.infer<typeof reputationQuerySchema>;
