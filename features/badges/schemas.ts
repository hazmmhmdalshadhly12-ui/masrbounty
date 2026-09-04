import { z } from 'zod';
export const badgesSchema=z.object({id:z.string().uuid().optional()});
