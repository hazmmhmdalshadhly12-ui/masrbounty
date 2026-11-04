import { GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { requireSession } from '@/lib/auth/guard';
import { createServerClient } from '@/lib/supabase/server';
import { AcademyManager, type AdminCourse, type AdminLesson } from '@/components/admin/academy-manager';

export const dynamic = 'force-dynamic';

export default async function AdminAcademyPage() {
  await requireSession({ roles: ['admin', 'moderator'], next: '/admin' });
  const supabase = await createServerClient();
  const [{ data: courses }, { data: lessons }] = await Promise.all([
    supabase.from('academy_courses').select('*').order('sort_order', { ascending: true }),
    supabase
      .from('academy_lessons')
      .select('id, course_id, title_ar, objectives, content_ar, video_url, attachment_path, duration_minutes, sort_order, is_published, generated_by_ai, ai_reviewed, quiz, quiz_pass_score')
      .order('sort_order', { ascending: true }),
  ]);

  const allCourses = (courses ?? []) as unknown as AdminCourse[];
  const allLessons = (lessons ?? []).map((l) => {
    const row = l as Record<string, unknown>;
    const quiz = Array.isArray(row['quiz']) ? (row['quiz'] as unknown[]) : null;
    return {
      id: String(row['id']),
      course_id: String(row['course_id']),
      title_ar: String(row['title_ar'] ?? ''),
      objectives: Array.isArray(row['objectives']) ? (row['objectives'] as string[]) : [],
      content_ar: (row['content_ar'] as string | null) ?? '',
      video_url: (row['video_url'] as string | null) ?? '',
      attachment_path: (row['attachment_path'] as string | null) ?? '',
      duration_minutes: Number(row['duration_minutes'] ?? 15),
      sort_order: Number(row['sort_order'] ?? 0),
      is_published: Boolean(row['is_published']),
      generated_by_ai: Boolean(row['generated_by_ai']),
      ai_reviewed: Boolean(row['ai_reviewed']),
      quiz_pass_score: Number(row['quiz_pass_score'] ?? 70),
      quizJson: quiz && quiz.length > 0 ? JSON.stringify(quiz, null, 2) : '',
    } satisfies AdminLesson;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={GraduationCap}
        title="إدارة الأكاديمية"
        desc="إنشاء الدورات والدروس والاختبارات — مع مراجعة إلزامية لأي درس يولّده الذكاء الاصطناعي قبل النشر."
      />
      <AcademyManager courses={allCourses} lessons={allLessons} />
    </div>
  );
}
