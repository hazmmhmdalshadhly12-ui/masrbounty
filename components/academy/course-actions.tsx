'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus, UserMinus, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enrollInCourseAction, unenrollFromCourseAction } from '@/features/academy/services';
import { toastSuccess, toastError } from '@/components/toasts/toast-utils';

export function CourseActions({
  courseId,
  enrolled,
  progressPercent,
}: {
  courseId: string;
  enrolled: boolean;
  progressPercent: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<'enroll' | 'unenroll' | null>(null);
  const [isEnrolled, setIsEnrolled] = React.useState(enrolled);

  async function enroll() {
    setBusy('enroll');
    const res = await enrollInCourseAction(courseId);
    if (res.ok) {
      setIsEnrolled(true);
      toastSuccess('تم التسجيل في الدورة — ابدأ من الدرس الأول');
      router.refresh();
    } else {
      toastError(res.error ?? 'فشل التسجيل');
    }
    setBusy(null);
  }

  async function unenroll() {
    setBusy('unenroll');
    const res = await unenrollFromCourseAction(courseId);
    if (res.ok) {
      setIsEnrolled(false);
      toastSuccess('تم إلغاء التسجيل');
      router.refresh();
    } else {
      toastError(res.error ?? 'فشل إلغاء التسجيل');
    }
    setBusy(null);
  }

  if (isEnrolled) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-4">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <GraduationCap className="h-4 w-4 text-primary" /> أنت مسجل في هذه الدورة
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{progressPercent}% مكتمل</span>
        <Button type="button" variant="ghost" size="sm" className="mr-auto text-xs text-muted-foreground" onClick={unenroll} disabled={busy !== null}>
          {busy === 'unenroll' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
          إلغاء التسجيل
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <Button type="button" onClick={enroll} disabled={busy !== null} className="gap-2">
        {busy === 'enroll' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        سجّل في الدورة لحفظ تقدمك
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">يمكنك تصفح الدروس بدون تسجيل، لكن التقدم والاختبارات والشهادة تتطلب التسجيل.</p>
    </div>
  );
}
