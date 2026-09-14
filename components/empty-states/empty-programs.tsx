import Link from 'next/link';
import { AppWindow } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

interface EmptyProgramsProps {
  title?: string;
  hint?: string;
  query?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyPrograms({
  title,
  hint = 'الشركات تضيف برامج جديدة باستمرار — ارجع قريبًا أو عدّل البحث.',
  query,
  actionHref = '/programs',
  actionLabel = 'عرض كل البرامج',
}: EmptyProgramsProps) {
  return (
    <EmptyState
      title={title ?? (query ? `لا نتائج عن “${query}”` : 'لا توجد برامج نشطة حاليًا')}
      hint={hint}
      icon={AppWindow}
      action={
        <Link href={actionHref}>
          <Button variant="outline" size="sm">
            {actionLabel}
          </Button>
        </Link>
      }
    />
  );
}
