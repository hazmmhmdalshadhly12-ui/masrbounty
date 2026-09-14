import * as React from 'react';
import { cn } from '@/lib/utils';

const Timeline = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<'ol'>>(
  ({ className, ...props }, ref) => (
    <ol ref={ref} className={cn('relative space-y-6 border-s border-border ps-6', className)} {...props} />
  ),
);
Timeline.displayName = 'Timeline';

const TimelineItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<'li'>>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn('relative', className)} {...props} />,
);
TimelineItem.displayName = 'TimelineItem';

function TimelineDot({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -start-[31px] mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-background',
        className,
      )}
      {...props}
    />
  );
}
TimelineDot.displayName = 'TimelineDot';

function TimelineContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />;
}
TimelineContent.displayName = 'TimelineContent';

function TimelineTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm font-semibold leading-none text-foreground', className)} {...props} />;
}
TimelineTitle.displayName = 'TimelineTitle';

function TimelineTime({ className, ...props }: React.HTMLAttributes<HTMLTimeElement>) {
  return <time className={cn('text-xs text-muted-foreground', className)} {...props} />;
}
TimelineTime.displayName = 'TimelineTime';

export { Timeline, TimelineItem, TimelineDot, TimelineContent, TimelineTitle, TimelineTime };
