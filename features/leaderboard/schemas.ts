import { z } from 'zod';

export const leaderboardSchema = z.object({
  id: z.string().uuid().optional(),
});

export const leaderboardQuerySchema = z.object({
  period: z.enum(['global', 'monthly']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LeaderboardInput = z.infer<typeof leaderboardSchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
