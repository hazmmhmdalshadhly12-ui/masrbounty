'use server';

/**
 * Academy admin management — courses / lessons / quizzes / AI lesson drafts.
 * Every mutation re-verifies staff role server-side (requireStaff) and is
 * audit-logged. AI-generated lessons are ALWAYS saved as unpublished drafts
 * (generated_by_ai=true) and must be reviewed + marked ai_reviewed before
 * publishing. Practical exercises are restricted to local labs / CTF-style
 * environments in the AI prompt — never attacks against real systems.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/admin-actions';
import { logAudit } from '@/services/audit';
import { runAiFeature } from '@/lib/ai/service';
import { slugify } from '@/utils/slug';
import { parseQuiz } from './quiz-schema';

const courseSchema = z.object({
  title_ar: z.string().trim().min(3).max(200),
  title_en: z.string().trim().max(200).optional().or(z.literal('')),
  description_ar: z.string().trim().max(5000).optional().or(z.literal('')),
  description_en: z.string().trim().max(5000).optional().or(z.literal('')),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  category: z.string().trim().min(2).max(60).default('general'),
  cover_image_url: z.string().trim().max(600).optional().or(z.literal('')),
  is_free: z.boolean().default(true),
  price: z.number().min(0).max(100000).nullable().optional(),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
});

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

function revalidateAcademy(): void {
  revalidatePath('/admin/academy');
  revalidatePath('/academy');
  revalidatePath('/dashboard/learning');
}

export async function createCourseAction(fd: FormData): Promise<{ ok: boolean; courseId?: string; error?: string }> {
  try {
    const { supabase, user } = await requireStaff();
    const parsed = courseSchema.safeParse({
      title_ar: s(fd, 'title_ar'),
      title_en: s(fd, 'title_en'),
      description_ar: s(fd, 'description_ar'),
      description_en: s(fd, 'description_en'),
      level: s(fd, 'level') || 'beginner',
      category: s(fd, 'category') || 'general',
      cover_image_url: s(fd, 'cover_image_url'),
      is_free: fd.get('is_free') !== 'off',
      price: s(fd, 'price') ? Number(s(fd, 'price')) : null,
      sort_order: s(fd, 'sort_order') || 0,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
    const d = parsed.data;
    const baseSlug = s(fd, 'slug') ? slugify(s(fd, 'slug')) : slugify(d.title_en || d.title_ar);
    const slug = baseSlug || `course-${Date.now()}`;
    const { data: existing } = await supabase.from('academy_courses').select('id').eq('slug', slug).maybeSingle();
    if (existing) return { ok: false, error: 'المعرّف (slug) مستخدم بالفعل — اختر معرفًا آخر' };
    const { data: created, error } = await supabase
      .from('academy_courses')
      .insert({
        slug,
        title_ar: d.title_ar,
        title_en: d.title_en || null,
        description_ar: d.description_ar || null,
        description_en: d.description_en || null,
        level: d.level,
        category: d.category,
        cover_image_url: d.cover_image_url || null,
        is_free: d.is_free,
        price: d.is_free ? null : (d.price ?? null),
        sort_order: d.sort_order,
        created_by: user.id,
        is_published: false,
      })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'فشل إنشاء الدورة: ' + (error?.message ?? '') };
    const courseId = (created as { id: string }).id;
    await logAudit('create', 'academy_courses', courseId, { slug }, user.id);
    revalidateAcademy();
    return { ok: true, courseId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export async function updateCourseAction(id: string, fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff();
    const parsed = courseSchema.safeParse({
      title_ar: s(fd, 'title_ar'),
      title_en: s(fd, 'title_en'),
      description_ar: s(fd, 'description_ar'),
      description_en: s(fd, 'description_en'),
      level: s(fd, 'level') || 'beginner',
      category: s(fd, 'category') || 'general',
      cover_image_url: s(fd, 'cover_image_url'),
      is_free: fd.get('is_free') !== 'off',
      price: s(fd, 'price') ? Number(s(fd, 'price')) : null,
      sort_order: s(fd, 'sort_order') || 0,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
    const d = parsed.data;
    const patch: Record<string, unknown> = {
      title_ar: d.title_ar,
      title_en: d.title_en || null,
      description_ar: d.description_ar || null,
      description_en: d.description_en || null,
      level: d.level,
      category: d.category,
      cover_image_url: d.cover_image_url || null,
      is_free: d.is_free,
      price: d.is_free ? null : (d.price ?? null),
      sort_order: d.sort_order,
    };
    const newSlug = s(fd, 'slug') ? slugify(s(fd, 'slug')) : '';
    if (newSlug) patch['slug'] = newSlug;
    const { error } = await supabase.from('academy_courses').update(patch).eq('id', id);
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return { ok: false, error: 'المعرّف (slug) مستخدم بالفعل' };
      return { ok: false, error: 'فشل التحديث: ' + error.message };
    }
    await logAudit('update', 'academy_courses', id, {}, user.id);
    revalidateAcademy();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export async function setCoursePublishedAction(id: string, publish: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff();
    if (publish) {
      // Guard: cannot publish a course with zero published lessons.
      const { count } = await supabase
        .from('academy_lessons')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', id)
        .eq('is_published', true);
      if (!count) return { ok: false, error: 'أضف درسًا واحدًا منشورًا على الأقل قبل نشر الدورة' };
    }
    const { error } = await supabase.from('academy_courses').update({ is_published: publish }).eq('id', id);
    if (error) return { ok: false, error: 'فشل التغيير: ' + error.message };
    await logAudit('update', 'academy_courses', id, { publish }, user.id);
    revalidateAcademy();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export async function deleteCourseAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const { error } = await supabase.from('academy_courses').delete().eq('id', id);
    if (error) return { ok: false, error: 'فشل الحذف: ' + error.message };
    await logAudit('delete', 'academy_courses', id, {}, user.id);
    revalidateAcademy();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

const lessonSchema = z.object({
  title_ar: z.string().trim().min(3).max(200),
  title_en: z.string().trim().max(200).optional().or(z.literal('')),
  objectives_raw: z.string().max(2000).optional().or(z.literal('')),
  content_ar: z.string().max(60000).optional().or(z.literal('')),
  video_url: z.string().trim().max(600).optional().or(z.literal('')),
  attachment_path: z.string().trim().max(600).optional().or(z.literal('')),
  duration_minutes: z.coerce.number().int().min(1).max(480).default(15),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
  is_published: z.boolean().default(false),
  quiz_pass_score: z.coerce.number().int().min(0).max(100).default(70),
});

export async function createLessonAction(courseId: string, fd: FormData): Promise<{ ok: boolean; lessonId?: string; error?: string }> {
  try {
    const { supabase, user } = await requireStaff();
    const parsed = lessonSchema.safeParse({
      title_ar: s(fd, 'title_ar'),
      title_en: s(fd, 'title_en'),
      objectives_raw: s(fd, 'objectives_raw'),
      content_ar: s(fd, 'content_ar'),
      video_url: s(fd, 'video_url'),
      attachment_path: s(fd, 'attachment_path'),
      duration_minutes: s(fd, 'duration_minutes') || 15,
      sort_order: s(fd, 'sort_order') || 0,
      is_published: fd.get('is_published') === 'on',
      quiz_pass_score: s(fd, 'quiz_pass_score') || 70,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
    const d = parsed.data;
    const quiz = parseQuiz(s(fd, 'quiz'));
    if (s(fd, 'quiz') && !quiz) return { ok: false, error: 'صيغة الاختبار غير صالحة (JSON: q, options[], correct)' };
    const objectives = d.objectives_raw
      ? d.objectives_raw.split('\n').map((x) => x.trim()).filter(Boolean)
      : [];
    const { data: created, error } = await supabase
      .from('academy_lessons')
      .insert({
        course_id: courseId,
        title_ar: d.title_ar,
        title_en: d.title_en || null,
        objectives,
        content_ar: d.content_ar || null,
        video_url: d.video_url || null,
        attachment_path: d.attachment_path || null,
        duration_minutes: d.duration_minutes,
        sort_order: d.sort_order,
        is_published: d.is_published,
        quiz_pass_score: d.quiz_pass_score,
        quiz: quiz ?? null,
      })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'فشل إنشاء الدرس: ' + (error?.message ?? '') };
    const lessonId = (created as { id: string }).id;
    await logAudit('create', 'academy_lessons', lessonId, { course_id: courseId }, user.id);
    revalidateAcademy();
    return { ok: true, lessonId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export async function updateLessonAction(lessonId: string, fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff();
    const parsed = lessonSchema.safeParse({
      title_ar: s(fd, 'title_ar'),
      title_en: s(fd, 'title_en'),
      objectives_raw: s(fd, 'objectives_raw'),
      content_ar: s(fd, 'content_ar'),
      video_url: s(fd, 'video_url'),
      attachment_path: s(fd, 'attachment_path'),
      duration_minutes: s(fd, 'duration_minutes') || 15,
      sort_order: s(fd, 'sort_order') || 0,
      is_published: fd.get('is_published') === 'on',
      quiz_pass_score: s(fd, 'quiz_pass_score') || 70,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
    const d = parsed.data;
    const quiz = parseQuiz(s(fd, 'quiz'));
    if (s(fd, 'quiz') && !quiz) return { ok: false, error: 'صيغة الاختبار غير صالحة (JSON: q, options[], correct)' };
    const objectives = d.objectives_raw
      ? d.objectives_raw.split('\n').map((x) => x.trim()).filter(Boolean)
      : [];
    const { error } = await supabase
      .from('academy_lessons')
      .update({
        title_ar: d.title_ar,
        title_en: d.title_en || null,
        objectives,
        content_ar: d.content_ar || null,
        video_url: d.video_url || null,
        attachment_path: d.attachment_path || null,
        duration_minutes: d.duration_minutes,
        sort_order: d.sort_order,
        is_published: d.is_published,
        quiz_pass_score: d.quiz_pass_score,
        quiz: quiz ?? null,
      })
      .eq('id', lessonId);
    if (error) return { ok: false, error: 'فشل التحديث: ' + error.message };
    await logAudit('update', 'academy_lessons', lessonId, {}, user.id);
    revalidateAcademy();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export async function deleteLessonAction(lessonId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const { error } = await supabase.from('academy_lessons').delete().eq('id', lessonId);
    if (error) return { ok: false, error: 'فشل الحذف: ' + error.message };
    await logAudit('delete', 'academy_lessons', lessonId, {}, user.id);
    revalidateAcademy();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/** Mark an AI-generated lesson as human-reviewed (required before publishing). */
export async function markLessonReviewedAction(lessonId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff();
    const { error } = await supabase.from('academy_lessons').update({ ai_reviewed: true }).eq('id', lessonId);
    if (error) return { ok: false, error: 'فشل التحديث: ' + error.message };
    await logAudit('update', 'academy_lessons', lessonId, { ai_reviewed: true }, user.id);
    revalidateAcademy();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

const AI_LESSON_TOPICS_HINT =
  'أساسيات اختبار الاختراق، HTTP/HTTPS، DNS، الشبكات، OWASP Top 10، اكتشاف الثغرات، كتابة تقارير Bug Bounty، XSS في بيئة آمنة، SQL Injection في مختبر محلي، Broken Access Control، IDOR تعليمي، Authentication Testing، أمن API، أساسيات Linux، أساسيات Burp Suite، تحليل نتائج الفحص.';

/**
 * Generate an educational lesson draft with AI (staff: admin/moderator).
 * The lesson is saved as an UNPUBLISHED draft flagged generated_by_ai —
 * a staff member must review it, mark it reviewed, and only then publish.
 *
 * Anti-duplicate guards (the "it generates again" bug):
 *  1. Topic dedupe — if this course already has an UNREVIEWED AI draft whose
 *     creation request carried the same topic within the last 10 minutes,
 *     return that existing draft instead of burning another generation;
 *  2. Zero silent retries — lesson generation is non-idempotent, so a lost
 *     response no longer re-runs the whole completion (which used to look like
 *     the generator "coming around again" and could double-charge tokens).
 */
export async function generateLessonAiAction(
  courseId: string,
  topic: string,
  level: 'beginner' | 'intermediate' | 'advanced'
): Promise<{ ok: boolean; lessonId?: string; error?: string; setupHint?: boolean; deduped?: boolean }> {
  try {
    const { supabase, user } = await requireStaff();
    const cleanTopic = topic.trim().slice(0, 200);
    if (cleanTopic.length < 3) return { ok: false, error: 'اكتب موضوع الدرس (3 أحرف على الأقل)' };
    const { data: course } = await supabase
      .from('academy_courses')
      .select('id, title_ar')
      .eq('id', courseId)
      .maybeSingle();
    if (!course) return { ok: false, error: 'الدورة غير موجودة' };

    // (1) Topic dedupe: a recent unreviewed AI draft for the same topic in the
    // same course is returned as-is instead of generating a duplicate.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: dup } = await supabase
      .from('academy_lessons')
      .select('id')
      .eq('course_id', courseId)
      .eq('generated_by_ai', true)
      .eq('ai_reviewed', false)
      .eq('ai_topic', cleanTopic)
      .gte('created_at', tenMinutesAgo)
      .limit(1);
    const dupHit = (dup as { id: string }[] | null)?.[0] ?? null;
    if (dupHit) {
      return {
        ok: true,
        lessonId: dupHit.id,
        deduped: true,
      };
    }

    const systemPrompt = [
      'أنت مدرّس أمن سيبراني محترف تكتب دروسًا تعليمية بالعربية للمبتدئين في منصة Bug Bounty.',
      'قواعد صارمة:',
      '- كل التدريبات العملية تكون في مختبر محلي أو بيئة CTF مصرح بها فقط.',
      '- لا تقدم أبدًا تعليمات لمهاجمة مواقع حقيقية بدون إذن، ولا طرقًا لتجاوز الحماية أو سرقة الحسابات أو إتلاف الأنظمة.',
      '- المحتوى تعليمي دفاعي/استكشافي أخلاقي: الفهم، الاكتشاف في بيئة معملية، والكتابة المهنية.',
      '- استخدم أمثلة آمنة (مختبر محلي مثل DVWA أو خوادم localhost).',
      '- اكتب بالعربية الواضحة المناسبة للمستوى المطلوب.',
      'أعِد JSON بالمخطط التالي فقط: {"title_ar": "...", "title_en": "...", "description_ar": "...", "objectives": ["...", "..."], "content_ar": "نص الدرس الكامل بصيغة عناوين وفقرات (استخدم \\n\\n بين الأقسام وعناوين تبدأ بـ ## )", "safe_examples": "أمثلة آمنة داخل مختبر محلي", "quiz": [{"q": "...", "options": ["...","...","..."], "correct": 0, "explanation": "..."}], "duration_minutes": 20}',
      'quiz يجب أن يحتوي 3-5 أسئلة اختيار من متعدد.',
    ].join('\n');
    const userPrompt = `أنشئ درسًا في موضوع: "${cleanTopic}"\nالمستوى: ${level}\nالدورة: ${(course as { title_ar: string }).title_ar}\nأمثلة مواضيع المنهج: ${AI_LESSON_TOPICS_HINT}`;

    const res = await runAiFeature({
      userId: user.id,
      feature: 'lesson_generator',
      systemPrompt,
      userPrompt,
      maxTokens: 8000, // thinking models (e.g. Gemini 2.5) spend output tokens on reasoning too
      temperature: 0.5,
      jsonMode: true,
      retries: 0, // (2) non-idempotent — never silently re-run the generation
      timeoutMs: 120_000, // a full JSON lesson needs well over 60s on slow providers
    });
    if (!res.ok) return { ok: false, error: res.message, setupHint: res.code === 'not_configured' };

    // Parse the generated JSON defensively.
    let lesson: {
      title_ar?: string;
      title_en?: string;
      description_ar?: string;
      objectives?: string[];
      content_ar?: string;
      safe_examples?: string;
      quiz?: unknown;
      duration_minutes?: number;
    } | null = null;
    try {
      const cleaned = res.content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      lesson = JSON.parse(cleaned);
    } catch {
      return { ok: false, error: 'رد غير مفهوم من خدمة الذكاء الاصطناعي — أعد المحاولة' };
    }
    if (!lesson || typeof lesson.title_ar !== 'string' || typeof lesson.content_ar !== 'string') {
      return { ok: false, error: 'الدرس المولّد ناقص (عنوان أو محتوى) — أعد المحاولة بموضوع أوضح' };
    }
    const quizValidated = parseQuiz(typeof lesson.quiz === 'string' ? lesson.quiz : JSON.stringify(lesson.quiz ?? []));
    const objectives = Array.isArray(lesson.objectives)
      ? lesson.objectives.filter((o): o is string => typeof o === 'string').slice(0, 10)
      : [];
    const fullContent = lesson.safe_examples && typeof lesson.safe_examples === 'string'
      ? `${lesson.content_ar}\n\n## مثال آمن (مختبر محلي)\n\n${lesson.safe_examples}`
      : lesson.content_ar;

    const { data: created, error } = await supabase
      .from('academy_lessons')
      .insert({
        course_id: courseId,
        title_ar: lesson.title_ar.slice(0, 200),
        title_en: typeof lesson.title_en === 'string' ? lesson.title_en.slice(0, 200) : null,
        objectives,
        content_ar: fullContent.slice(0, 60000),
        duration_minutes: Number(lesson.duration_minutes) >= 1 ? Math.min(Number(lesson.duration_minutes), 240) : 20,
        sort_order: 999,
        is_published: false,
        generated_by_ai: true,
        ai_reviewed: false,
        ai_topic: cleanTopic,
        quiz_pass_score: 70,
        quiz: quizValidated ?? null,
      })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'فشل حفظ مسودة الدرس: ' + (error?.message ?? '') };
    const lessonId = (created as { id: string }).id;
    await logAudit('create', 'academy_lessons', lessonId, { course_id: courseId, generated_by_ai: true, topic: cleanTopic }, user.id);
    revalidateAcademy();
    return { ok: true, lessonId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}
