import { z } from 'zod';
export const adminSchema=z.object({id:z.string().uuid().optional()});
