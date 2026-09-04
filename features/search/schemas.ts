import { z } from 'zod';
export const searchSchema=z.object({id:z.string().uuid().optional()});
