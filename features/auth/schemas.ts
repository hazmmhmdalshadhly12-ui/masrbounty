import { z } from 'zod';

export const authSchema = z.object({
  id: z.string().uuid().optional(),
});

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerInputSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['researcher', 'company']),
});

export const resetRequestSchema = z.object({
  email: z.string().email(),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export type AuthInput = z.infer<typeof authSchema>;
export type LoginFormInput = z.infer<typeof loginInputSchema>;
