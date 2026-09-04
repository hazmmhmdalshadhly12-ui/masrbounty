import { z } from 'zod';
export const reputationSchema=z.object({id:z.string().uuid().optional()});
