import { redirect } from 'next/navigation';
import { Gauge } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth/guard';
import { PageHeader } from '@/components/shared/page-header';
import { ReportLimitsAdmin } from '@/components/admin/report-limits-admin';

export const dynamic = 'force-dynamic';

export default async function AdminReportLimitsPage() {
  await requireSession({ roles: ['admin', 'moderator'], next: '/admin' });
  const supabase = await createServerClient();
  const [{ data: roles }, { data: settings }, { data: overrides }, { data: abuse }] = await Promise.all([
    supabase.from('user_roles').select('role'),
    supabase.from('platform_settings').select('value').eq('key', 'report_limits').maybeSingle(),
    supabase.from('report_limit_overrides').select('user_id, daily_limit, hourly_limit, reason, updated_at'),
    supabase
      .from('suspicious_events')
      .select('id, user_id, kind, detail, severity, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  const staffRoles = new Set(((roles ?? []) as { role: string }[]).map((r) => r.role));
  const isAdmin = staffRoles.has('admin');
  if (!isAdmin && !staffRoles.has('moderator')) redirect('/admin');

  const val = (settings as { value?: Record<string, unknown> } | null)?.value ?? {};
  const dailyMax = Number(val['daily_max'] ?? 10);
  const hourlyMax = Number(val['hourly_max'] ?? 5);

  const overrideRows = ((overrides ?? []) as Record<string, unknown>[]).map((o) => ({
    userId: String(o['user_id']),
    daily: o['daily_limit'] == null ? null : Number(o['daily_limit']),
    hourly: o['hourly_limit'] == null ? null : Number(o['hourly_limit']),
    reason: (o['reason'] as string | null) ?? '',
  }));

  const abuseRows = ((abuse ?? []) as Record<string, unknown>[]).map((a) => ({
    id: String(a['id']),
    userId: (a['user_id'] as string | null) ?? '',
    kind: String(a['kind'] ?? ''),
    detail: String(a['detail'] ?? ''),
    severity: String(a['severity'] ?? 'medium'),
    createdAt: String(a['created_at'] ?? ''),
  }));

  const userIds = [...new Set([...overrideRows.map((o) => o.userId), ...abuseRows.map((a) => a.userId)].filter(Boolean))];
  const { data: profs } = userIds.length
    ? await supabase.from('profiles').select('id, username').in('id', userIds)
    : { data: null };
  const usernameMap = new Map(((profs ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]));

  return (
    <div className="space-y-6">
      <PageHeader icon={Gauge} title="حدود التقارير ومكافحة الإساءة" desc="الحد اليومي/الساعي على إرسال التقارير (لا يشمل المسودات أو التعديل)، استثناءات لكل مستخدم، ومراقبة محاولات الإساءة." />
      <ReportLimitsAdmin
        isAdmin={isAdmin}
        dailyMax={dailyMax}
        hourlyMax={hourlyMax}
        overrides={overrideRows.map((o) => ({ ...o, username: usernameMap.get(o.userId) ?? o.userId.slice(0, 8) }))}
        abuse={abuseRows.map((a) => ({ ...a, username: usernameMap.get(a.userId) ?? '' }))}
      />
    </div>
  );
}
