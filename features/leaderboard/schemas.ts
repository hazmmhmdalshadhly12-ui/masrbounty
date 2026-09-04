import { z } from 'zod';
export const leaderboardSchema=z.object({id:z.string().uuid().optional()});
