'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const programVisibilityBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      visibility: {
        public: 'border border-transparent bg-success/12 text-success ring-1 ring-inset ring-success/25',
        private:
          'border border-transparent bg-warning/12 text-warning ring-1 ring-inset ring-warning/25',
        draft:
          'border border-transparent bg-muted text-muted-foreground ring-1 ring-inset ring-muted-foreground/25',
      },
    },
    defaultVariants: {
      visibility: 'public',
    },
  }
);

export type ProgramVisibility = NonNullable<
  VariantProps<typeof programVisibilityBadgeVariants>['visibility']
>;

const visibilityLabels: Record<ProgramVisibility, string> = {
  public: 'عام',
  private: 'خاص',
  draft: 'مسودة',
};

export interface ProgramVisibilityBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof programVisibilityBadgeVariants> {}

export function ProgramVisibilityBadge({
  className,
  visibility = 'public',
  ...props
}: ProgramVisibilityBadgeProps) {
  const key = (visibility ?? 'public') as ProgramVisibility;
  return (
    <span className={cn(programVisibilityBadgeVariants({ visibility }), className)} {...props}>
      {visibilityLabels[key]}
    </span>
  );
}
