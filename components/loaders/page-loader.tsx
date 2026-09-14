import { cn } from '@/lib/utils';
import { Spinner } from '@/components/loaders/spinner';

interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  title?: string;
}

export function PageLoader({ label, title = 'جارٍ التحميل…', className, ...props }: PageLoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 p-10 text-center', className)} role="status" {...props}>
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{label ?? title}</p>
    </div>
  );
}
