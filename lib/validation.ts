import { z } from 'zod';

export const uuid = z.string().uuid();

export const pagination = z.object({
  page: z.coerce.number().min(1).default(1),
  per: z.coerce.number().min(1).max(100).default(20),
});

export const emailSchema = z.string().trim().toLowerCase().email();

export const slugField = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9\u0600-\u06FF]+(?:-[a-z0-9\u0600-\u06FF]+)*$/, 'Invalid slug');

export const egyptianPhoneSchema = z
  .string()
  .trim()
  .regex(/^01[0-9]{9}$/, 'Invalid Egyptian phone')
  .optional()
  .or(z.literal('').transform(() => undefined));

export type PaginationInput = z.infer<typeof pagination>;
