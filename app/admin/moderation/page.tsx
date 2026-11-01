import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/admin-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ShieldAlert } from 'lucide-react';

const TARGET_TYPES = ['report', 'user', 'program', 'company', 'dispute'] as const;
const ACTIONS = ['warn', 'suspend', 'ban', 'unban', 'remove_content', 'note'] as const;
const ACTION_AR: Record<string, string> = {
  warn: 'تحذير',
  suspend: 'إيقاف مؤقت',
  ban: 'حظر',
  unban: 'رفع الحظر',
  remove_content: 'إزالة محتوى',
  note: 'ملاحظة',
};

async function moderate(formData: FormData) {
  'use server';
  const { supabase, user } = await requireStaff(['admin', 'moderator']);
  const targetType = String(formData.get('target_type') ?? '');
  const targetId = String(formData.get('target_id') ?? '').trim();
  const action = String(formData.get('action') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  // Validate inputs before touching the DB — no raw client data
  if (!TARGET_TYPES.includes(targetType as (typeof TARGET_TYPES)[number])) {
    redirect('/admin/moderation?error=' + encodeURIComponent('نوع الهدف غير صالح'));
  }
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    redirect('/admin/moderation?error=' + encodeURIComponent('نوع الإجراء غير صالح'));
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(targetId)) {
    redirect('/admin/moderation?error=' + encodeURIComponent('معرّف الهدف يجب أن يكون UUID صحيحًا'));
  }
  if (reason.length < 3) {
    redirect('/admin/moderation?error=' + encodeURIComponent('السبب مطلوب (3 أحرف على الأقل)'));
  }
  const { error } = await supabase.from('moderation_actions').insert({
    moderator_id: user.id,
    target_type: targetType,
    target_id: targetId,
    action,
    reason,
  });
  if (error) redirect('/admin/moderation?error=' + encodeURIComponent('تعذر تسجيل الإجراء'));
  revalidatePath('/admin/moderation');
  redirect('/admin/moderation?ok=' + encodeURIComponent('تم تسجيل إجراء الإشراف'));
}

export default async function Moderation({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('moderation_actions')
    .select('id,target_type,target_id,action,reason,created_at,profiles!moderation_actions_moderator_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as {
    id: string;
    target_type: string;
    target_id: string;
    action: string;
    reason: string;
    created_at: string;
    profiles: { username: string } | null;
  }[];

  return (
    <div className="container max-w-2xl space-y-6 py-8" dir="rtl">
      <PageHeader icon={ShieldAlert} title="الإشراف" desc="سجل إجراءات الإشراف اليدوية — كل إجراء موثق بمسؤول عنه." />

      {sp.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
          <CardContent className="p-3 text-sm text-red-700 dark:text-red-300">{sp.error}</CardContent>
        </Card>
      )}
      {sp.ok && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CardContent className="p-3 text-sm text-emerald-700 dark:text-emerald-300">{sp.ok}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">تسجيل إجراء جديد</CardTitle>
          <CardDescription>المعرّف (UUID) للهدف — انسخه من صفحة العنصر المعني (تقرير/مستخدم/برنامج).</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={moderate} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select name="target_type" className="h-10 rounded-md border bg-card px-2 text-sm dark:border-slate-700">
                {TARGET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'report' ? 'تقرير' : t === 'user' ? 'مستخدم' : t === 'program' ? 'برنامج' : t === 'company' ? 'شركة' : 'نزاع'}
                  </option>
                ))}
              </select>
              <Input name="target_id" required placeholder="Target UUID" dir="ltr" className="max-w-xs" />
              <select name="action" className="h-10 rounded-md border bg-card px-2 text-sm dark:border-slate-700">
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_AR[a]}
                  </option>
                ))}
              </select>
            </div>
            <Input name="reason" required placeholder="سبب الإجراء (يظهر في السجل)" />
            <Button type="submit">تسجيل الإجراء</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-bold">آخر الإجراءات ({rows.length})</p>
        {!rows.length ? (
          <EmptyState title="لا توجد إجراءات إشراف بعد" hint="ستظهر هنا كل الإجراءات المسجلة مع المتوّلي عليها." />
        ) : (
          rows.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{m.target_type}</span>{' '}
                    {ACTION_AR[m.action] ?? m.action}
                    {m.profiles?.username && (
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {' '}
                        بواسطة @{m.profiles.username}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString('ar-EG')}
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
