import * as React from 'react';
import { cn } from '@/lib/utils';

interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

function Topbar({ title, description, actions, className, children, ...props }: TopbarProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {title && <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{title}</h1>}
        {description && <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Legacy placeholder export retained so existing imports keep working. */
function Tmp() {
  return null;
}

export { Topbar, Tmp };
export type { TopbarProps };
