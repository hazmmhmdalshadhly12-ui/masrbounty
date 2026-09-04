import { z } from 'zod';
export const authSchema=z.object({id:z.string().uuid().optional()});
