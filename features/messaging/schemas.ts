import { z } from 'zod';
export const messagingSchema=z.object({id:z.string().uuid().optional()});
