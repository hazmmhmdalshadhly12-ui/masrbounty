import { z } from 'zod';

export const programSchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  description: z.string().min(20),
  visibility: z.enum(['public', 'private']),
  scope: z.string().min(10),
  contact_email: z.string().email(),
});

export type ProgramInput = z.infer<typeof programSchema>;
