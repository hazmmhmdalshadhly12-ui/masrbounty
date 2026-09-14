import * as React from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  time: string;
}

interface ActivityFeedProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  items?: ActivityItem[];
}

function ActivityFeed({ title = 'Recent activity', items = [], className, ...props }: ActivityFeedProps) {
  return (
    <Card className={cn('overflow-hidden', className)} {...props}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                <span className="font-semibold">{item.actor}</span>{' '}
                <span className="text-muted-foreground">{item.action}</span>
              </p>
              <p className="text-xs text-muted-foreground">{item.time}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { ActivityFeed };
export type { ActivityFeedProps };
