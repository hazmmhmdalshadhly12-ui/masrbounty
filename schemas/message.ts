import { z } from 'zod';
export const messageSchema=z.object({conversation_id:z.string().uuid(),body:z.string().min(1).max(10000)});
