import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/time';

export interface AuditLogRow {
  id: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  actor_id?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface AuditTableProps extends React.HTMLAttributes<HTMLDivElement> {
  logs?: AuditLogRow[];
  title?: string;
}

export function AuditTable({ logs = [], title = 'سجلات التدقيق', className, ...props }: AuditTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-card-foreground', className)} {...props}>
      {title && <h3 className="border-b px-4 py-3 text-sm font-bold">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">الإجراء</th>
              <th className="px-4 py-3 font-medium">الكيان</th>
              <th className="px-4 py-3 font-medium">الفاعل</th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  لا توجد سجلات بعد.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="font-mono" dir="ltr">
                    {log.action}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium">{log.entity}</span>
                  {log.entity_id && (
                    <span className="block font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {log.entity_id.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground" dir="ltr">
                  {log.actor_id ? `${log.actor_id.slice(0, 8)}…` : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
