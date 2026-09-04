import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(3),
  website: z.string().url().optional(),
});

export type CompanyInput = z.infer<typeof companySchema>;
