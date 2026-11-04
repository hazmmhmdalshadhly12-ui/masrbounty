'use server';

/**
 * Academy (Penetration Testing Academy) — learner-facing services.
 *
 * All enrollment/progress/quiz state lives in the DATABASE (RLS-protected),
 * never in localStorage. Quiz grading happens SERVER-SIDE: the client never
 * receives the correct answers before submitting. Course completion can
 * auto-issue a verifiable certificate exactly once (DB RPC).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { enforceRate } from '@/lib/rate-limit';
import { logAudit } from '@/services/audit';

export type AcademyCourse = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  cover_image_url: string | null;
  is_published: boolean;
  is_free: boolean;
  sort_order: number;
};

export type AcademyLessonSummary = {
  id: string;
  title_ar: string;
  duration_minutes: number;
  sort_order: number;
  is_published: boolean;
  has_quiz: boolean;
  completed: boolean;
};

export type QuizQuestion = { q: string; options: string[]; correct: number; explanation?: string };

export const LEVEL_LABELS: Record<string, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
};

async function getOptionalUser() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

/** Published course catalog with optional filters (guest-accessible). */
export async function listAcademyCourses(filters?: {
  level?: string;
  q?: string;
  category?: string;
}): Promise<{
  ok: boolean;
  courses: (AcademyCourse & { lessonsCount: number })[];
  error?: string;
}> {
  try {
    const { supabase } = await getOptionalUser();
    let query = supabase
      .from('academy_courses')
      .select('id, slug, title_ar, title_en, description_ar, description_en, level, category, cover_image_url, is_published, is_free, sort_order')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (filters?.level && ['beginner', 'intermediate', 'advanced'].includes(filters.level)) {
      query = query.eq('level', filters.level);
    }
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.q && filters.q.trim()) {
      const like = `%${filters.q.trim().replace(/[%_]/g, '')}%`;
      query = query.or(`title_ar.ilike.${like},title_en.ilike.${like},description_ar.ilike.${like}`);
    }
    const { data, error } = await query;
    if (error) return { ok: false, courses: [], error: error.message };
    const courses = (data ?? []) as AcademyCourse[];
    const { supabase: s2 } = await getOptionalUser();
    const { count } = await s2
      .from('academy_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true);
    void count;
    // per-course lesson counts (single query, grouped client-side)
    const { data: lessonRows } = await supabase
      .from('academy_lessons')
      .select('id, course_id')
      .eq('is_published', true);
    const counts = new Map<string, number>();
    for (const l of (lessonRows ?? []) as { id: string; course_id: string }[]) {
      counts.set(l.course_id, (counts.get(l.course_id) ?? 0) + 1);
    }
    return {
      ok: true,
      courses: courses.map((c) => ({ ...c, lessonsCount: counts.get(c.id) ?? 0 })),
    };
  } catch (e) {
    return { ok: false, courses: [], error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/** Course page data: course + its published lessons + my progress. */
export async function getAcademyCourse(slug: string): Promise<{
  ok: boolean;
  course?: AcademyCourse;
  lessons?: AcademyLessonSummary[];
  enrolled?: boolean;
  progressPercent?: number;
  myCertificates?: string[];
  error?: string;
}> {
  try {
    const { supabase, userId } = await getOptionalUser();
    const { data: course } = await supabase
      .from('academy_courses')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    if (!course) return { ok: false, error: 'الدورة غير موجودة أو غير منشورة' };
    const c = course as AcademyCourse;
    const { data: lessons } = await supabase
      .from('academy_lessons')
      .select('id, title_ar, duration_minutes, sort_order, is_published, quiz')
      .eq('course_id', c.id)
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    let completed = new Set<string>();
    let enrolled = false;
    let progressPercent = 0;
    let myCertificates: string[] = [];
    if (userId) {
      const [progRes, enrollRes] = await Promise.all([
        supabase.from('academy_lesson_progress').select('lesson_id').eq('user_id', userId),
        supabase
          .from('academy_enrollments')
          .select('id')
          .eq('course_id', c.id)
          .eq('user_id', userId)
          .maybeSingle(),
      ]);
      completed = new Set(((progRes.data ?? []) as { lesson_id: string }[]).map((p) => p.lesson_id));
      enrolled = Boolean(enrollRes.data);
      const total = (lessons ?? []).length;
      progressPercent = total === 0 ? 0 : Math.min(100, Math.round((completed.size * 100) / total));
      if (enrolled) {
        const { data: certs } = await supabase
          .from('certificates')
          .select('certificate_number')
          .eq('user_id', userId)
          .eq('type', 'academy_course')
          .eq('course_id', c.id);
        myCertificates = ((certs ?? []) as { certificate_number: string }[]).map((x) => x.certificate_number);
      }
    }
    return {
      ok: true,
      course: c,
      lessons: ((lessons ?? []) as { id: string; title_ar: string; duration_minutes: number; sort_order: number; is_published: boolean; quiz: unknown }[]).map(
        (l) => ({
          id: l.id,
          title_ar: l.title_ar,
          duration_minutes: l.duration_minutes,
          sort_order: l.sort_order,
          is_published: l.is_published,
          has_quiz: Array.isArray(l.quiz) && l.quiz.length > 0,
          completed: completed.has(l.id),
        })
      ),
      enrolled,
      progressPercent,
      myCertificates,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/** Lesson page data (content stripped of quiz answers). */
export async function getAcademyLesson(lessonId: string): Promise<{
  ok: boolean;
  lesson?: {
    id: string;
    course_id: string;
    courseSlug: string;
    courseTitle: string;
    title_ar: string;
    title_en: string | null;
    objectives: string[];
    content_ar: string | null;
    video_url: string | null;
    attachment_path: string | null;
    duration_minutes: number;
    has_quiz: boolean;
    quizQuestions: { q: string; options: string[] }[];
    quiz_pass_score: number;
    completed: boolean;
  };
  neighbors?: { prevId: string | null; nextId: string | null };
  enrolled?: boolean;
  progressPercent?: number;
  error?: string;
}> {
  try {
    const { supabase, userId } = await getOptionalUser();
    const { data: lesson } = await supabase
      .from('academy_lessons')
      .select('*')
      .eq('id', lessonId)
      .eq('is_published', true)
      .maybeSingle();
    if (!lesson) return { ok: false, error: 'الدرس غير موجود أو غير منشور' };
    const l = lesson as {
      id: string;
      course_id: string;
      title_ar: string;
      title_en: string | null;
      objectives: string[];
      content_ar: string | null;
      video_url: string | null;
      attachment_path: string | null;
      duration_minutes: number;
      quiz: unknown;
      quiz_pass_score: number;
    };
    const { data: course } = await supabase
      .from('academy_courses')
      .select('slug, title_ar, is_published')
      .eq('id', l.course_id)
      .eq('is_published', true)
      .maybeSingle();
    if (!course) return { ok: false, error: 'دورة الدرس غير منشورة' };
    const co = course as { slug: string; title_ar: string };
    const { data: siblings } = await supabase
      .from('academy_lessons')
      .select('id, sort_order')
      .eq('course_id', l.course_id)
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    const list = (siblings ?? []) as { id: string; sort_order: number }[];
    const idx = list.findIndex((s) => s.id === l.id);
    let enrolled = false;
    let completed = false;
    let progressPercent = 0;
    if (userId) {
      const [en, prog] = await Promise.all([
        supabase
          .from('academy_enrollments')
          .select('id')
          .eq('course_id', l.course_id)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('academy_lesson_progress')
          .select('id')
          .eq('lesson_id', l.id)
          .eq('user_id', userId)
          .maybeSingle(),
      ]);
      enrolled = Boolean(en.data);
      completed = Boolean(prog.data);
      const { data: rpc } = await supabase.rpc('academy_course_progress', { p_course: l.course_id });
      const row = Array.isArray(rpc) ? (rpc[0] as { percent?: number } | undefined) : undefined;
      progressPercent = Number(row?.percent ?? 0);
    }
    const quiz = Array.isArray(l.quiz) ? (l.quiz as QuizQuestion[]) : [];
    // NEVER expose `correct`/`explanation` to the client before grading.
    const quizQuestions = quiz.map((q) => ({ q: q.q, options: q.options }));
    return {
      ok: true,
      lesson: {
        id: l.id,
        course_id: l.course_id,
        courseSlug: co.slug,
        courseTitle: co.title_ar,
        title_ar: l.title_ar,
        title_en: l.title_en,
        objectives: Array.isArray(l.objectives) ? l.objectives : [],
        content_ar: l.content_ar,
        video_url: l.video_url,
        attachment_path: l.attachment_path,
        duration_minutes: l.duration_minutes,
        has_quiz: quiz.length > 0,
        quizQuestions,
        quiz_pass_score: l.quiz_pass_score,
        completed,
      },
      neighbors: {
        prevId: idx > 0 ? list[idx - 1].id : null,
        nextId: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
      },
      enrolled,
      progressPercent,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/** Enroll the signed-in user in a published course. */
export async function enrollInCourseAction(courseId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getOptionalUser();
    if (!userId) return { ok: false, error: 'سجّل الدخول للتسجيل في الدورة' };
    enforceRate(`academy-enroll:${userId}`, 20, 60_000);
    const { data: course } = await supabase
      .from('academy_courses')
      .select('id, is_published')
      .eq('id', courseId)
      .eq('is_published', true)
      .maybeSingle();
    if (!course) return { ok: false, error: 'الدورة غير منشورة' };
    const { error } = await supabase
      .from('academy_enrollments')
      .insert({ course_id: courseId, user_id: userId });
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: 'فشل التسجيل: ' + error.message };
    }
    await logAudit('create', 'academy_enrollments', courseId, { course_id: courseId }, userId);
    revalidatePath('/academy');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export async function unenrollFromCourseAction(courseId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getOptionalUser();
    if (!userId) return { ok: false, error: 'انتهت الجلسة' };
    const { error } = await supabase
      .from('academy_enrollments')
      .delete()
      .eq('course_id', courseId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: 'فشل إلغاء التسجيل: ' + error.message };
    revalidatePath('/academy');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/** Mark a lesson complete; auto-issues the certificate at 100% (DB RPC). */
export async function completeLessonAction(
  lessonId: string
): Promise<{ ok: boolean; percent?: number; certificateNumber?: string | null; error?: string }> {
  try {
    const { supabase, userId } = await getOptionalUser();
    if (!userId) return { ok: false, error: 'سجّل الدخول لحفظ تقدمك' };
    const { data: lesson } = await supabase
      .from('academy_lessons')
      .select('id, course_id, is_published')
      .eq('id', lessonId)
      .eq('is_published', true)
      .maybeSingle();
    if (!lesson) return { ok: false, error: 'الدرس غير منشور' };
    const courseId = (lesson as { course_id: string }).course_id;
    const { data: en } = await supabase
      .from('academy_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!en) return { ok: false, error: 'سجّل في الدورة أولًا لحفظ التقدم' };
    const { error } = await supabase
      .from('academy_lesson_progress')
      .insert({ lesson_id: lessonId, user_id: userId });
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: 'فشل حفظ الإكمال: ' + error.message };
    }
    const { data: rpc } = await supabase.rpc('academy_course_progress', { p_course: courseId });
    const row = Array.isArray(rpc) ? (rpc[0] as { total_lessons?: number; completed_lessons?: number; percent?: number }) : undefined;
    const percent = Number(row?.percent ?? 0);
    let certificateNumber: string | null = null;
    if (row && row.total_lessons && row.completed_lessons && row.completed_lessons >= row.total_lessons) {
      try {
        const { data: cert } = await supabase.rpc('issue_course_certificate', { p_course: courseId });
        certificateNumber = typeof cert === 'string' ? cert : null;
      } catch {
        certificateNumber = null; // cert already issued or course conditions changed
      }
    }
    revalidatePath(`/academy/lessons/${lessonId}`);
    revalidatePath('/dashboard/learning');
    return { ok: true, percent, certificateNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

const answersSchema = z.object({
  lessonId: z.string().uuid(),
  answers: z.array(z.number().int().min(-1).max(9)).min(1).max(30),
});

/** Grade a quiz attempt SERVER-SIDE (correct answers never sent to client). */
export async function saveQuizAttemptAction(
  lessonId: string,
  answers: number[]
): Promise<
  | {
      ok: true;
      score: number;
      passed: boolean;
      perQuestion: boolean[];
      explanations: (string | null)[];
      passScore: number;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = answersSchema.safeParse({ lessonId, answers });
    if (!parsed.success) return { ok: false, error: 'إجابات غير صالحة' };
    const { supabase, userId } = await getOptionalUser();
    if (!userId) return { ok: false, error: 'سجّل الدخول للاختبار' };
    const { data: lesson } = await supabase
      .from('academy_lessons')
      .select('id, course_id, quiz, quiz_pass_score, is_published')
      .eq('id', lessonId)
      .eq('is_published', true)
      .maybeSingle();
    if (!lesson) return { ok: false, error: 'الدرس غير منشور' };
    const l = lesson as { course_id: string; quiz: unknown; quiz_pass_score: number };
    const { data: en } = await supabase
      .from('academy_enrollments')
      .select('id')
      .eq('course_id', l.course_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!en) return { ok: false, error: 'سجّل في الدورة أولًا' };
    const quiz = Array.isArray(l.quiz) ? (l.quiz as QuizQuestion[]) : [];
    if (quiz.length === 0) return { ok: false, error: 'لا يوجد اختبار لهذا الدرس' };
    if (parsed.data.answers.length !== quiz.length) return { ok: false, error: 'عدد الإجابات غير مطابق' };
    const perQuestion = quiz.map((q, i) => parsed.data.answers[i] === q.correct);
    const correctCount = perQuestion.filter(Boolean).length;
    const score = Math.round((correctCount * 100) / quiz.length);
    const passed = score >= (l.quiz_pass_score ?? 70);
    const { error } = await supabase.from('academy_quiz_attempts').insert({
      lesson_id: lessonId,
      user_id: userId,
      score,
      passed,
      answers: parsed.data.answers,
    });
    if (error) return { ok: false, error: 'فشل حفظ المحاولة: ' + error.message };
    return {
      ok: true,
      score,
      passed,
      perQuestion,
      explanations: quiz.map((q) => q.explanation ?? null),
      passScore: l.quiz_pass_score ?? 70,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/** Signed URL for a course material (enrolled users only, server-checked). */
export async function getLessonMaterialUrlAction(
  lessonId: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const { supabase, userId } = await getOptionalUser();
    if (!userId) return { ok: false, error: 'سجّل الدخول للوصول إلى الملف' };
    const { data: lesson } = await supabase
      .from('academy_lessons')
      .select('course_id, attachment_path, is_published')
      .eq('id', lessonId)
      .eq('is_published', true)
      .maybeSingle();
    if (!lesson) return { ok: false, error: 'الدرس غير موجود' };
    const l = lesson as { course_id: string; attachment_path: string | null };
    if (!l.attachment_path) return { ok: false, error: 'لا يوجد ملف مرفق' };
    const { data: en } = await supabase
      .from('academy_enrollments')
      .select('id')
      .eq('course_id', l.course_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!en) return { ok: false, error: 'الملف متاح للمسجلين في الدورة فقط' };
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from('academy-materials')
      .createSignedUrl(l.attachment_path, 600);
    if (error || !data) return { ok: false, error: 'تعذر توليد رابط الملف' };
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/** My learning: enrollments with progress + certificates (dashboard). */
export async function getMyLearningAction(): Promise<{
  ok: boolean;
  courses?: {
    course: AcademyCourse;
    enrolledAt: string;
    completedAt: string | null;
    percent: number;
    certificateNumber: string | null;
  }[];
  quizStats?: { attempts: number; passed: number; avgScore: number };
  error?: string;
}> {
  try {
    const { supabase, userId } = await getOptionalUser();
    if (!userId) return { ok: false, error: 'انتهت الجلسة' };
    const { data: enrolls } = await supabase
      .from('academy_enrollments')
      .select('course_id, enrolled_at, completed_at')
      .eq('user_id', userId)
      .order('enrolled_at', { ascending: false });
    const enrollRows = (enrolls ?? []) as { course_id: string; enrolled_at: string; completed_at: string | null }[];
    const result: {
      course: AcademyCourse;
      enrolledAt: string;
      completedAt: string | null;
      percent: number;
      certificateNumber: string | null;
    }[] = [];
    for (const e of enrollRows) {
      const { data: c } = await supabase.from('academy_courses').select('*').eq('id', e.course_id).maybeSingle();
      if (!c) continue;
      const { data: rpc } = await supabase.rpc('academy_course_progress', { p_course: e.course_id });
      const row = Array.isArray(rpc) ? (rpc[0] as { percent?: number } | undefined) : undefined;
      const { data: cert } = await supabase
        .from('certificates')
        .select('certificate_number')
        .eq('user_id', userId)
        .eq('type', 'academy_course')
        .eq('course_id', e.course_id)
        .maybeSingle();
      result.push({
        course: c as AcademyCourse,
        enrolledAt: e.enrolled_at,
        completedAt: e.completed_at,
        percent: Number(row?.percent ?? 0),
        certificateNumber: (cert as { certificate_number: string } | null)?.certificate_number ?? null,
      });
    }
    const { data: attempts } = await supabase
      .from('academy_quiz_attempts')
      .select('score, passed')
      .eq('user_id', userId);
    const at = (attempts ?? []) as { score: number; passed: boolean }[];
    const quizStats = {
      attempts: at.length,
      passed: at.filter((a) => a.passed).length,
      avgScore: at.length ? Math.round(at.reduce((s, a) => s + a.score, 0) / at.length) : 0,
    };
    return { ok: true, courses: result, quizStats };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}
