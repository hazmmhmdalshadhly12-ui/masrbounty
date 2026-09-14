import { z } from 'zod';

export const reportsSchema = z.object({
  id: z.string().uuid().optional(),
});

export const reportFilterSchema = z.object({
  program_id: z.string().uuid().optional(),
  status: z
    .enum(['draft', 'submitted', 'triaged', 'informative', 'duplicate', 'not_applicable', 'accepted', 'resolved', 'closed'])
    .optional(),
  severity: z.enum(['informational', 'low', 'medium', 'high', 'critical']).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const reportCommentSchema = z.object({
  report_id: z.string().uuid(),
  body: z.string().min(1).max(10000),
  is_internal: z.boolean().default(false),
});

export type ReportsFilterInput = z.infer<typeof reportFilterSchema>;
export type ReportCommentInput = z.infer<typeof reportCommentSchema>;
