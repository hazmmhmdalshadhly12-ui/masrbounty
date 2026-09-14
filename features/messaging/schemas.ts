import { z } from 'zod';

export const messagingSchema = z.object({
  id: z.string().uuid().optional(),
});

export const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().min(1).max(10000),
});

export const startConversationSchema = z.object({
  user_id: z.string().uuid(),
  subject: z.string().max(200).optional(),
});

export const markReadSchema = z.object({
  conversation_id: z.string().uuid(),
});

export type MessagingInput = z.infer<typeof messagingSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
