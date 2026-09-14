import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const egyptianPhone = z
  .string()
  .regex(/^01[0-9]{9}$/, 'رقم الهاتف يجب أن يكون 11 رقمًا يبدأ بـ 01')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const registerSchema = z
  .object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    full_name: z.string().min(2, 'الاسم الكامل مطلوب').max(100).optional(),
    phone: egyptianPhone,
    role: z.enum(['researcher', 'company']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا السر غير متطابقتين',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
