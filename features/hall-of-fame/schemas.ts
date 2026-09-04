import { z } from 'zod';
export const hallOfFameSchema=z.object({id:z.string().uuid().optional()});
