import { z } from 'zod';

export const hallOfFameSchema = z.object({
  id: z.string().uuid().optional(),
});

export const hallOfFameEntrySchema = z.object({
  researcher_id: z.string().uuid(),
  company_id: z.string().uuid().optional(),
  program_id: z.string().uuid().optional(),
  achievement: z.string().min(5).max(1000),
  display_name: z.string().min(2).max(120),
});

export type HallOfFameInput = z.infer<typeof hallOfFameSchema>;
export type HallOfFameEntryInput = z.infer<typeof hallOfFameEntrySchema>;
