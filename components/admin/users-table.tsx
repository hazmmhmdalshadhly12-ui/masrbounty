import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/avatar';
import { formatDate } from '@/utils/time';

export interface AdminUserRow {
  id: string;
  username: string;
  full_name?: string | null;
  is_active: boolean;
  created_at: string;
}

interface UsersTableProps extends React.HTMLAttributes<HTMLDivElement> {
  users?: AdminUserRow[];
  title?: string;
}

export function UsersTable({ users = [], title = 'المستخدمون', className, ...props }: UsersTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-card-foreground', className)} {...props}>
      {title && <h3 className="border-b px-4 py-3 text-sm font-bold">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">المستخدم</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">انضم</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  لا يوجد مستخدمون مطابقون.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <Avatar name={u.username} size="sm" />
                    <span>
                      <span className="block font-bold" dir="ltr">
                        @{u.username}
                      </span>
                      {u.full_name && <span className="block text-xs text-muted-foreground">{u.full_name}</span>}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.is_active ? <Badge>نشط</Badge> : <Badge variant="destructive">موقوف</Badge>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
