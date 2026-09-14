import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/shared/avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { timeAgo } from '@/utils/time';

export interface HofEntry {
  id: string;
  display_name: string;
  achievement: string;
  recognized_at: string;
}

interface HofGridProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: HofEntry[];
  title?: string;
}

export function HofGrid({ items = [], title, className, ...props }: HofGridProps) {
  if (!items.length) {
    return <EmptyState title={title ?? 'لا تكريمات بعد'} hint="الشركات تكرّم الباحثين علنًا هنا عند الاكتشافات المميزة." icon={Trophy} />;
  }
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)} {...props}>
      {items.map((h) => (
        <Card key={h.id} className="transition-shadow hover:shadow-lg">
          <CardContent className="flex gap-4 p-6">
            <Avatar name={h.display_name} size="lg" />
            <div className="min-w-0">
              <p className="font-black">{h.display_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{h.achievement}</p>
              <p className="mt-2 text-xs text-muted-foreground">{timeAgo(h.recognized_at)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
