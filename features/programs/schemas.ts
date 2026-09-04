import { z } from 'zod';
export const programsSchema=z.object({id:z.string().uuid().optional()});
