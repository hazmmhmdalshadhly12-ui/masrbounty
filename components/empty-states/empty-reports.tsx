import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

interface EmptyReportsProps {
  title?: string;
  hint?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyReports({
  title = 'لا توجد تقارير بعد',
  hint = 'أنشئ مسودتك الأولى وستظهر هنا — تتبع حالتها أولًا بأول.',
  actionHref = '/dashboard/reports/new',
  actionLabel = 'تقرير جديد',
}: EmptyReportsProps) {
  return (
    <EmptyState
      title={title}
      hint={hint}
      icon={Inbox}
      action={
        <Link href={actionHref}>
          <Button size="sm">{actionLabel}</Button>
        </Link>
      }
    />
  );
}
