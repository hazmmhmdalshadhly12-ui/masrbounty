import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { BadgeCheck, Clock, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';

const verificationBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      status: {
        verified: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        pending: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
        rejected: 'border-transparent bg-destructive/10 text-destructive',
        unverified: 'border-input text-muted-foreground',
      },
    },
    defaultVariants: { status: 'unverified' },
  },
);

export interface VerificationBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof verificationBadgeVariants> {
  label?: string;
}

const statusIcons = {
  verified: BadgeCheck,
  pending: Clock,
  rejected: ShieldX,
  unverified: ShieldX,
} as const;

const defaultLabels: Record<string, string> = {
  verified: 'Verified',
  pending: 'Pending',
  rejected: 'Rejected',
  unverified: 'Unverified',
};

function VerificationBadge({ status = 'unverified', label, className, ...props }: VerificationBadgeProps) {
  const Icon = statusIcons[status ?? 'unverified'] ?? ShieldX;
  return (
    <span className={cn(verificationBadgeVariants({ status }), className)} {...props}>
      <Icon className="h-3.5 w-3.5" />
      {label ?? defaultLabels[status ?? 'unverified'] ?? status}
    </span>
  );
}

export { VerificationBadge, verificationBadgeVariants };
