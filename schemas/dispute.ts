import { z } from 'zod';
export const disputeSchema=z.object({report_id:z.string().uuid(),reason:z.string().min(10)});
