import { z } from 'zod';
export const walletSchema=z.object({id:z.string().uuid().optional()});
