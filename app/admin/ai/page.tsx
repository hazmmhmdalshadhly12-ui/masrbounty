import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/guard';
import { PageHeader } from '@/components/shared/page-header';
import { getAiEnvConfig, AI_SETUP_HINT_AR } from '@/lib/ai/config';
import { AiAdmin } from '@/components/admin/ai-admin';
import type { AiUsageStat } from '@/components/admin/ai-admin';

export const dynamic = 'force-dynamic';

export default async function AdminAiPage() {
  await requireSession({ roles: ['admin', 'moderator'], next: '/admin' });
  const supabase = await createServerClient();
  const { data: roles } = await supabase.from('user_roles').select('role');
  const staffRoles = new Set(((roles ?? []) as { role: string }[]).map((r) => r.role));
  const isAdmin = staffRoles.has('admin');
  if (!isAdmin && !staffRoles.has('moderator')) redirect('/admin');

  const admin = createAdminClient();
  const [{ data: settings }, { data: byFeature }, { data: recent }, { data: topUsers }] = await Promise.all([
    admin.from('ai_settings').select('*').eq('id', 1).maybeSingle(),
    admin.from('ai_usage_logs').select('feature, ok').order('created_at', { ascending: false }).limit(5000),
    admin
      .from('ai_usage_logs')
      .select('id, user_id, feature, model, ok, error_code, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('ai_usage_logs')
      .select('user_id, ok')
      .order('created_at', { ascending: false })
      .limit(5000),
  ]);
  const { data: profs } = await admin.from('profiles').select('id, username').limit(5000);
  const usernameMap = new Map(((profs ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]));

  const logs = ((byFeature ?? []) as { feature: string; ok: boolean }[]);
  const featureStats = new Map<string, AiUsageStat>();
  for (const l of logs) {
    const s = featureStats.get(l.feature) ?? { feature: l.feature, total: 0, failed: 0 };
    s.total += 1;
    if (!l.ok) s.failed += 1;
    featureStats.set(l.feature, s);
  }

  const userCounts = new Map<string, number>();
  for (const l of ((topUsers ?? []) as { user_id: string | null; ok: boolean }[])) {
    if (!l.user_id) continue;
    userCounts.set(l.user_id, (userCounts.get(l.user_id) ?? 0) + 1);
  }
  const top = [...userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([userId, count]) => ({ username: usernameMap.get(userId) ?? userId.slice(0, 8), count }));

  const s = (settings ?? {}) as Record<string, unknown>;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: monthCount } = await admin
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString());

  return (
    <div className="space-y-6">
      <PageHeader icon={Sparkles} title="إدارة الذكاء الاصطناعي" desc="تفعيل/تعطيل الخدمة، حدود الاستخدام، الميزات المسموحة، وإحصائيات الاستهلاك. المفتاح يُدار من Cloudflare Pages فقط ولا يُخزّن هنا أبدًا." />
      {!getAiEnvConfig().configured && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {AI_SETUP_HINT_AR}
        </p>
      )}
      <AiAdmin
        isAdmin={isAdmin}
        settings={{
          enabled: s['enabled'] !== false,
          daily_limit_per_user: Number(s['daily_limit_per_user'] ?? 25),
          per_minute_limit: Number(s['per_minute_limit'] ?? 6),
          monthly_budget_requests: Number(s['monthly_budget_requests'] ?? 20000),
          allowed_features: Array.isArray(s['allowed_features']) ? (s['allowed_features'] as string[]) : ['report_assistant', 'lesson_generator'],
          default_model: (s['default_model'] as string | null) ?? '',
        }}
        stats={{
          monthTotal: monthCount ?? 0,
          byFeature: [...featureStats.values()],
          topUsers: top,
          recent: ((recent ?? []) as Record<string, unknown>[]).map((r) => ({
            id: String(r['id']),
            username: usernameMap.get(String(r['user_id'] ?? '')) ?? '—',
            feature: String(r['feature'] ?? ''),
            model: String(r['model'] ?? ''),
            ok: Boolean(r['ok']),
            errorCode: (r['error_code'] as string | null) ?? null,
            createdAt: String(r['created_at'] ?? ''),
          })),
        }}
      />
    </div>
  );
}
