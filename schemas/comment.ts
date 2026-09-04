import { z } from 'zod';
export const commentSchema=z.object({report_id:z.string().uuid(),body:z.string().min(1).max(10000)});
