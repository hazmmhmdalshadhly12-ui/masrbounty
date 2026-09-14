import { z } from 'zod';

export const notificationsSchema = z.object({
  id: z.string().uuid().optional(),
});

export const notificationIdSchema = z.object({
  notification_id: z.string().uuid(),
});

export const notificationPreferencesSchema = z.object({
  email_reports: z.boolean(),
  email_bounty: z.boolean(),
  email_messages: z.boolean(),
  email_program: z.boolean(),
});

export type NotificationsInput = z.infer<typeof notificationsSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
