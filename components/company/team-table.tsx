import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/avatar';

export interface TeamMemberRow {
  id: string;
  username?: string | null;
  role: string;
}

const roleAr: Record<string, string> = {
  owner: 'المؤسس',
  admin: 'مدير',
  triager: 'فارز',
  viewer: 'مشاهد',
};

interface TeamTableProps extends React.HTMLAttributes<HTMLDivElement> {
  members?: TeamMemberRow[];
  title?: string;
}

export function TeamTable({ members = [], title = 'أعضاء الفريق', className, ...props }: TeamTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-card-foreground', className)} {...props}>
      {title && <h3 className="border-b px-4 py-3 text-sm font-bold">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">العضو</th>
              <th className="px-4 py-3 font-medium">الدور</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  لا أعضاء بعد — ادعُ زملاءك من نموذج الدعوة.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <Avatar name={m.username ?? m.role} size="sm" />
                    <span className="font-medium" dir="ltr">
                      @{m.username ?? '—'}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{roleAr[m.role] ?? m.role}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
