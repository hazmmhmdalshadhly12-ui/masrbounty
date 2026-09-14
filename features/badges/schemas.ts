import { z } from 'zod';

export const badgesSchema = z.object({
  id: z.string().uuid().optional(),
});

export const badgeSchema = z.object({
  code: z.string().min(2).max(60),
  name_ar: z.string().min(2).max(120),
  name_en: z.string().min(2).max(120),
  description_ar: z.string().max(1000).optional(),
  description_en: z.string().max(1000).optional(),
  icon: z.string().max(120).optional(),
});

export const awardBadgeSchema = z.object({
  researcher_id: z.string().uuid(),
  badge_id: z.string().uuid(),
});

export type BadgesInput = z.infer<typeof badgesSchema>;
export type BadgeInput = z.infer<typeof badgeSchema>;
export type AwardBadgeInput = z.infer<typeof awardBadgeSchema>;
