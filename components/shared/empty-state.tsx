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
    <Card className="border-dashed shadow-sm">
      <CardContent className="flex flex-col items-center p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted shadow-sm">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </span>
        <p className="mt-4 text-base font-bold tracking-tight">{title}</p>
        {hint && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{hint}</p>}
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
