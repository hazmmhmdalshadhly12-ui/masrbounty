import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { Settings2 } from 'lucide-react';

const KNOWN_SETTINGS: Record<string, string> = {
  platform_fee: 'عمولة المنصة — {"percent": 10} أو رقم مثل 10',
  vf_cash_number: 'رقم فودافون كاش للتحويل — "01xxxxxxxxx"',
};

async function save(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: me } = await supabase.auth.getUser();
  const { data: roles } = me.user
    ? await supabase.from('user_roles').select('role').eq('user_id', me.user.id)
    : { data: [] };
  if (!me.user || !(roles ?? []).some((r: { role: string }) => r.role === 'admin')) {
    const { forbidden } = await import('next/navigation');
    forbidden();
  }
  const key = String(formData.get('key') ?? '').trim();
  const raw = String(formData.get('value') ?? '').trim();
  if (!key) redirect('/admin/settings?error=' + encodeURIComponent('المفتاح مطلوب'));
  // Validate JSON up-front — a malformed value must not crash the action
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect('/admin/settings?error=' + encodeURIComponent('قيمة غير صالحة — يجب أن تكون JSON صحيحًا (مثال: {"percent": 10} أو 10 أو "نص")'));
  }
  if (typeof parsed === 'number' && !Number.isFinite(parsed)) {
    redirect('/admin/settings?error=' + encodeURIComponent('رقم غير صالح'));
  }
  const { error } = await supabase.from('platform_settings').upsert({ key, value: parsed as never });
  if (error) redirect('/admin/settings?error=' + encodeURIComponent('تعذر الحفظ: ' + (error.message ?? 'خطأ غير معروف')));
  revalidatePath('/admin/settings');
  redirect('/admin/settings?ok=' + encodeURIComponent(`تم حفظ الإعداد «${key}»`));
}

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const { data: me } = await supabase.auth.getUser();
  const { data: roles } = me.user
    ? await supabase.from('user_roles').select('role').eq('user_id', me.user.id)
    : { data: [] };
  if (!me.user || !(roles ?? []).some((r: { role: string }) => r.role === 'admin')) {
    const { forbidden } = await import('next/navigation');
    forbidden();
  }
  const { data } = await supabase.from('platform_settings').select('*').order('key');

  return (
    <div className="container max-w-2xl py-8 space-y-4" dir="rtl">
      <PageHeader icon={Settings2} title="إعدادات المنصة" desc="مفاتيح الإعداد العامة (JSON) — تؤثر مباشرة على سلوك المنصة." />

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

      {(data ?? []).map((s: { key: string; value: unknown; updated_at?: string }) => (
        <Card key={s.key}>
          <CardContent className="p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <b dir="ltr">{s.key}</b>
              <span dir="ltr" className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                {JSON.stringify(s.value)}
              </span>
            </div>
            {KNOWN_SETTINGS[s.key] && <p className="mt-1 text-xs text-muted-foreground">{KNOWN_SETTINGS[s.key]}</p>}
          </CardContent>
        </Card>
      ))}
      {!(data ?? []).length && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">لا توجد إعدادات محفوظة بعد.</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">إضافة / تحديث إعداد</CardTitle>
          <CardDescription>
            القيمة JSON. أمثلة: عمولة المنصة <span dir="ltr" className="font-mono">{'{"percent": 10}'}</span> أو رقم{' '}
            <span dir="ltr" className="font-mono">10</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={save} className="flex flex-wrap gap-2">
            <Input name="key" required placeholder="key" dir="ltr" className="max-w-[180px]" />
            <Input name="value" required placeholder='{"percent": 10}' dir="ltr" className="max-w-xs" />
            <Button type="submit">حفظ</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
