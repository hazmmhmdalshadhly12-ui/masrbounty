import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const;

export function Spinner({ size = 'md', title, className, ...props }: SpinnerProps) {
  return (
    <span className={cn('inline-flex items-center justify-center', className)} role="status" aria-label={title ?? 'جارٍ التحميل'} {...props}>
      <Loader2 className={cn('animate-spin text-muted-foreground', sizes[size])} />
    </span>
  );
}
