import { Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/empty-state';
import { BadgeCard, type BadgeData } from '@/components/badges/badge-card';

interface BadgeGridProps extends React.HTMLAttributes<HTMLDivElement> {
  badges?: BadgeData[];
  title?: string;
  emptyHint?: string;
}

export function BadgeGrid({
  badges = [],
  title,
  emptyHint = 'الأوسمة تُمنح تلقائيًا عند تحقيق الإنجازات — واصل الصيد.',
  className,
  ...props
}: BadgeGridProps) {
  if (!badges.length) {
    return (
      <EmptyState
        title={title ?? 'لا أوسمة بعد'}
        hint={emptyHint}
        icon={Medal}
      />
    );
  }
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)} {...props}>
      {badges.map((b) => (
        <BadgeCard key={b.code} badge={b} />
      ))}
    </div>
  );
}
