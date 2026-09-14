import { AppWindow, Clock, FileCheck2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface CompanyAnalytics {
  total_reports?: number;
  resolved_reports?: number;
  avg_response_hours?: number;
  active_programs?: number;
}

interface AnalyticsPanelsProps extends React.HTMLAttributes<HTMLDivElement> {
  stats?: CompanyAnalytics;
  title?: string;
}

export function AnalyticsPanels({ stats, title, className, ...props }: AnalyticsPanelsProps) {
  const panels = [
    { label: 'إجمالي التقارير', value: stats?.total_reports ?? 0, Icon: FileText },
    { label: 'تقارير محلولة', value: stats?.resolved_reports ?? 0, Icon: FileCheck2 },
    { label: 'متوسط الاستجابة', value: `${stats?.avg_response_hours ?? 0}h`, Icon: Clock },
    { label: 'برامج نشطة', value: stats?.active_programs ?? 0, Icon: AppWindow },
  ];
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)} {...props}>
      {title && <h3 className="col-span-full text-sm font-bold text-muted-foreground">{title}</h3>}
      {panels.map(({ label, value, Icon }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <span className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="mt-2 block text-2xl font-black tabular-nums" dir="ltr">
              {value}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
