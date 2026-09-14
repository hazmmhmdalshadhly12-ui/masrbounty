import { z } from 'zod';

export const adminSchema = z.object({
  id: z.string().uuid().optional(),
});

export const moderationActionSchema = z.object({
  target_type: z.string().min(2).max(60),
  target_id: z.string().uuid(),
  action: z.string().min(2).max(60),
  reason: z.string().min(5).max(2000).optional(),
});

export const supportTicketUpdateSchema = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});

export const supportMessageSchema = z.object({
  ticket_id: z.string().uuid(),
  body: z.string().min(1).max(10000),
});

export const platformSettingSchema = z.object({
  key: z.string().min(2).max(100),
  value: z.record(z.unknown()),
});

export type AdminInput = z.infer<typeof adminSchema>;
export type ModerationActionInput = z.infer<typeof moderationActionSchema>;
export type PlatformSettingInput = z.infer<typeof platformSettingSchema>;
