import { z } from 'zod';

export const programSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9\u0600-\u06FF]+(?:-[a-z0-9\u0600-\u06FF]+)*$/, 'Invalid slug'),
  description: z.string().trim().min(20).max(10000),
  visibility: z.enum(['public', 'private']),
  scope: z.string().trim().min(10).max(10000),
  contact_email: z.string().trim().email().max(255),
});

export type ProgramInput = z.infer<typeof programSchema>;
