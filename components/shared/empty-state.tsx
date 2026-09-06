import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  title,
  hint,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="mt-4 font-bold">{title}</p>
        {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
