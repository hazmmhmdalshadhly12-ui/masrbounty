import { z } from 'zod';

export const searchSchema = z.object({
  id: z.string().uuid().optional(),
});

export const searchQuerySchema = z.object({
  query: z.string().min(2).max(200),
  scope: z.enum(['programs', 'reports', 'researchers', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(10),
});

export type SearchInput = z.infer<typeof searchSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
