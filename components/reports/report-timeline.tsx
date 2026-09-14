import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@/components/ui/timeline';

export interface ReportTimelineEvent {
  id: string;
  label: string;
  description?: string;
  date: string;
}

interface ReportTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  events?: ReportTimelineEvent[];
  title?: string;
}

function ReportTimeline({ events = [], title, className, ...props }: ReportTimelineProps) {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timeline events yet.</p>
      ) : (
        <Timeline>
          {events.map((event) => (
            <TimelineItem key={event.id}>
              <TimelineDot />
              <TimelineContent>
                <TimelineTitle>{event.label}</TimelineTitle>
                <TimelineTime>{event.date}</TimelineTime>
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </div>
  );
}

export { ReportTimeline };
export type { ReportTimelineProps };
