import { z } from 'zod';

/**
 * Quiz JSON schema + parser (pure module — imported by 'use server' files,
 * which may only export async functions).
 */
const quizQuestionSchema = z
  .object({
    q: z.string().trim().min(3).max(500),
    options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
    correct: z.number().int().min(0),
    explanation: z.string().trim().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.correct >= val.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'مؤشر الإجابة الصحيحة خارج نطاق الخيارات' });
    }
  });

export const quizSchema = z.array(quizQuestionSchema).min(1).max(20);

export function parseQuiz(raw: string | null | undefined): z.infer<typeof quizSchema> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = quizSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
