import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProgramRule = string | { title: string; description?: string };

interface RuleListProps extends React.HTMLAttributes<HTMLDivElement> {
  rules?: ProgramRule[];
  title?: string;
}

function RuleList({ rules = [], title = 'Program rules', className, ...props }: RuleListProps) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rules defined for this program.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule, index) => {
            const ruleTitle = typeof rule === 'string' ? rule : rule.title;
            const ruleDescription = typeof rule === 'string' ? undefined : rule.description;
            return (
              <li key={index} className="flex items-start gap-3 rounded-md border bg-card px-3 py-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{ruleTitle}</p>
                  {ruleDescription && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{ruleDescription}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { RuleList };
export type { RuleListProps };
