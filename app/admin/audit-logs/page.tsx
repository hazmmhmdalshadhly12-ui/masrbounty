import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollText, Lock, Calendar } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ACTIONS = ['create', 'update', 'delete', 'login', 'logout', 'award', 'payout', 'moderate', 'verify'] as const;
const actionAr: Record<string, string> = {
  create: 'إنشاء',
  update: 'تحديث',
  delete: 'حذف',
  login: 'دخول',
  logout: 'خروج',
  award: 'مكافأة',
  payout: 'صرف',
  moderate: 'إشراف',
  verify: 'تحقق',
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return d;
  }
}

export default async function AuditLogs({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; from?: string; to?: string; page?: string }>;
}) {
  const { action = '', entity = '', from = '', to = '', page: pageRaw = '1' } = await searchParams;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const pageSize = 30;
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  const supabase = await createServerClient();

  let query = supabase.from('audit_logs').select('id,actor_id,action,entity,entity_id,metadata,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(fromIdx, toIdx);

  if (action && (ACTIONS as readonly string[]).includes(action)) query = query.eq('action', action);
  if (entity.trim()) query = query.ilike('entity', `%${entity.trim().replace(/[%_\\]/g, '\\$&')}%`);
  if (from) {
    const f = new Date(from);
    if (!isNaN(f.getTime())) query = query.gte('created_at', f.toISOString());
  }
  if (to) {
    const t = new Date(to);
    if (!isNaN(t.getTime())) {
      // inclusive end of day
      t.setHours(23, 59, 59, 999);
      query = query.lte('created_at', t.toISOString());
    }
  }

  const { data, error, count } = await query;
  const rows = (data ?? []) as { id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; metadata: unknown; created_at: string }[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (action) sp.set('action', action);
    if (entity) sp.set('entity', entity);
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    sp.set('page', String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={ScrollText} title="سجل التدقيق" desc="عرض غير قابل للتعديل — فلترة حسب الإجراء، المورد، والتاريخ مع ترقيم الصفحات" />

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-2 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          هذا السجل لا يمكن تعديله أو حذفه عبر الواجهة — كل عملية حساسة تُسجل تلقائيًا عبر <code dir="ltr" className="rounded bg-white px-1 dark:bg-slate-900">logAudit</code>. حتى المدراء يملكون قراءة فقط هنا.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" /> فلترة
          </CardTitle>
          <CardDescription>فلتر حسب الإجراء والمورد ونطاق التاريخ</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2">
            <select name="action" defaultValue={action} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">كل الإجراءات</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {actionAr[a] ?? a} ({a})
                </option>
              ))}
            </select>
            <Input name="entity" defaultValue={entity} placeholder="المورد (مثلاً programs)" className="h-9 w-44" />
            <Input name="from" defaultValue={from} type="date" className="h-9 w-36" />
            <span className="flex items-center text-xs text-muted-foreground">إلى</span>
            <Input name="to" defaultValue={to} type="date" className="h-9 w-36" />
            <Button size="sm" type="submit" variant="outline">
              تطبيق
            </Button>
            <Link href="/admin/audit-logs">
              <Button size="sm" variant="ghost" type="button">
                مسح
              </Button>
            </Link>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error.message}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            {total} سجل — صفحة {page} من {totalPages}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!rows.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد سجلات بهذه الفلترة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="p-2 text-right">الوقت</th>
                    <th className="p-2 text-right">الإجراء</th>
                    <th className="p-2 text-right">المورد</th>
                    <th className="p-2 text-right">المعرّف</th>
                    <th className="p-2 text-right">الفاعل</th>
                    <th className="p-2 text-right">البيانات الوصفية</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">{formatDate(l.created_at)}</td>
                      <td className="p-2">
                        <Badge variant={l.action === 'moderate' || l.action === 'verify' ? 'destructive' : 'secondary'}>{actionAr[l.action] ?? l.action}</Badge>
                      </td>
                      <td className="p-2 font-mono text-xs" dir="ltr">
                        {l.entity}
                      </td>
                      <td className="p-2 font-mono text-xs" dir="ltr">
                        {l.entity_id ? `${l.entity_id.slice(0, 8)}…` : '—'}
                      </td>
                      <td className="p-2 font-mono text-xs" dir="ltr">
                        {l.actor_id ? `${l.actor_id.slice(0, 8)}…` : 'نظام'}
                      </td>
                      <td className="max-w-[260px] truncate p-2 font-mono text-xs" dir="ltr" title={JSON.stringify(l.metadata, null, 2)}>
                        {JSON.stringify(l.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Link href={buildHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-1.5 text-xs ${page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-accent'}`}>
            السابق
          </Link>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 7) p = i + 1;
            else if (page <= 4) p = i + 1;
            else if (page >= totalPages - 3) p = totalPages - 6 + i;
            else p = page - 3 + i;
            const active = p === page;
            return (
              <Link key={p} href={buildHref(p)} className={`rounded-md border px-3 py-1.5 text-xs font-mono ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-accent'}`}>
                {p}
              </Link>
            );
          })}
          <Link href={buildHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-1.5 text-xs ${page >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-accent'}`}>
            التالي
          </Link>
        </div>
      )}
    </div>
  );
}
