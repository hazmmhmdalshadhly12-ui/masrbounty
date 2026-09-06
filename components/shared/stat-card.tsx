import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  href?: string;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  const body = (
    <CardContent className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ? 'bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950' : 'bg-muted text-muted-foreground'}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-[26px] font-black leading-none tabular-nums tracking-tight">{value}</p>
      {href && <span className="mt-2 inline-block text-xs text-muted-foreground underline-offset-4 hover:underline">عرض التفاصيل</span>}
    </CardContent>
  );
  return (
    <Card className="overflow-hidden transition-colors hover:border-slate-400">
      {href ? <Link href={href} className="block">{body}</Link> : body}
    </Card>
  );
}
