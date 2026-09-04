import { z } from 'zod';
export const reportSchema=z.object({program_id:z.string().uuid(),title:z.string().min(10).max(200),summary:z.string().min(20),vulnerability_type:z.string().min(2),severity:z.enum(['informational','low','medium','high','critical']),affected_asset:z.string().min(2),description:z.string().min(30),impact:z.string().min(20),reproduction_steps:z.string().min(20),remediation:z.string().optional()});
export type ReportInput=z.infer<typeof reportSchema>;
