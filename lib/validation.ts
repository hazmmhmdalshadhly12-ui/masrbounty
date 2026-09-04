import { z } from 'zod';
export const uuid=z.string().uuid();
export const pagination=z.object({page:z.coerce.number().min(1).default(1),per:z.coerce.number().min(1).max(100).default(20)});
