import { z } from 'zod';

export const programsSchema = z.object({
  id: z.string().uuid().optional(),
});

export const programFilterSchema = z.object({
  status: z.enum(['draft', 'pending_review', 'active', 'paused', 'closed']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const programAssetSchema = z.object({
  program_id: z.string().uuid(),
  type: z.enum(['web', 'api', 'mobile', 'network', 'other']),
  value: z.string().min(2).max(500),
  description: z.string().max(2000).optional(),
});

export const programRuleSchema = z.object({
  program_id: z.string().uuid(),
  title: z.string().min(2).max(200),
  content: z.string().min(5).max(10000),
});

export type ProgramsFilterInput = z.infer<typeof programFilterSchema>;
