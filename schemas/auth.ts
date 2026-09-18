import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z
  .object({
    username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
    email: z.string().email('البريد الإلكتروني غير صالح'),
    password: z.string().min(8, 'كلمة السر يجب أن تكون 8 أحرف على الأقل'),
    confirmPassword: z.string().min(8, 'تأكيد كلمة السر مطلوب'),
    full_name: z.string().min(2, 'الاسم الكامل مطلوب').max(100, 'الاسم الكامل يجب ألا يتجاوز 100 حرف'),
    phone: z.string().regex(/^01[0-9]{9}$/, 'رقم الهاتف يجب أن يكون 11 رقمًا يبدأ بـ 01'),
    role: z.enum(['researcher', 'company']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا السر غير متطابقتين',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
