import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { Users, ShieldAlert, UserCog, Search } from 'lucide-react';
import { escapeLike } from '@/utils/search';

export const dynamic = 'force-dynamic';

async function requireAdminRole() {
  const supabase = await createServerClient();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', me.user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === 'admin')) throw new Error('للإدارة فقط');
  return { supabase, me: me.user };
}

async function setActive(userId: string, active: boolean, formData: FormData) {
  'use server';
  const { supabase, me } = await requireAdminRole();
  if (me.id === userId) throw new Error('لا يمكنك تغيير حالة حسابك نفسه');
  const reason = String(formData.get(`reason_${userId}`) ?? '').trim();
  const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', userId);
  if (error) throw new Error(error.message);
  await supabase.from('moderation_actions').insert({
    moderator_id: me.id,
    target_type: 'user',
    target_id: userId,
    action: active ? 'unban' : 'ban',
    reason: reason || null,
  });
  await logAudit('moderate', 'profiles', userId, { active, reason, by: me.id }, me.id);
  revalidatePath('/admin/users');
}

async function changeRole(userId: string, formData: FormData) {
  'use server';
  const { supabase, me } = await requireAdminRole();
  if (me.id === userId) throw new Error('لا يمكنك تغيير دورك نفسه من هنا');
  const role = String(formData.get(`role_${userId}`) ?? '').trim();
  if (!['researcher', 'company', 'moderator', 'admin'].includes(role)) throw new Error('دور غير صالح');
  const reason = String(formData.get(`reason_${userId}`) ?? '').trim();

  // Replace primary role (single role model). Keep audit.
  // First remove existing non-admin? But spec says role change with RLS + audit.
  // We will upsert: delete conflicting researcher/company if needed is not required; just upsert role.
  // Ensure we don't duplicate: user_roles has unique(user_id, role)
  const { error } = await supabase.from('user_roles').upsert({ user_id: userId, role, granted_by: me.id }, { onConflict: 'user_id,role' });
  if (error) throw new Error(error.message);

  // Optional: if switching away from researcher/company, keep old roles — admin can manually clean via SQL.
  await supabase.from('moderation_actions').insert({
    moderator_id: me.id,
    target_type: 'user',
    target_id: userId,
    action: 'role_change',
    reason: `to ${role}: ${reason || ''}`.trim(),
  });
  await logAudit('moderate', 'user_roles', userId, { role, reason }, me.id);
  revalidatePath('/admin/users');
}

async function removeRole(userId: string, role: string) {
  'use server';
  const { supabase, me } = await requireAdminRole();
  if (me.id === userId) throw new Error('لا يمكنك نزع دورك نفسه');
  if (!['researcher', 'company', 'moderator', 'admin'].includes(role)) throw new Error('دور غير صالح');
  const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
  if (error) throw new Error(error.message);
  await supabase.from('moderation_actions').insert({
    moderator_id: me.id,
    target_type: 'user',
    target_id: userId,
    action: 'role_remove',
    reason: role,
  });
  await logAudit('moderate', 'user_roles', userId, { removed: role }, me.id);
  revalidatePath('/admin/users');
}

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; active?: string }> }) {
  await requireAdminRole();
  const { q = '', role = '', active = '' } = await searchParams;
  const supabase = await createServerClient();

  let ids: string[] | null = null;
  if (role && ['researcher', 'company', 'moderator', 'admin'].includes(role)) {
    const { data: rr } = await supabase.from('user_roles').select('user_id').eq('role', role).limit(500);
    ids = (rr ?? []).map((r: { user_id: string }) => r.user_id);
  }

  let query = supabase.from('profiles').select('id,username,full_name,is_active,created_at').order('created_at', { ascending: false }).limit(100);
  if (q.trim()) {
    // search username or full_name
    query = query.or(`username.ilike.%${escapeLike(q.trim())}%,full_name.ilike.%${escapeLike(q.trim())}%`);
  }
  if (ids) query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  if (active === 'active') query = query.eq('is_active', true);
  if (active === 'suspended') query = query.eq('is_active', false);

  const { data: users, error } = await query;

  // Fetch roles for displayed users
  const userIds = (users ?? []).map((u) => u.id);
  let rolesMap: Record<string, string[]> = {};
  if (userIds.length) {
    const { data: rolesRows } = await supabase.from('user_roles').select('user_id,role').in('user_id', userIds);
    for (const r of (rolesRows ?? []) as { user_id: string; role: string }[]) {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    }
  }

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={Users} title="إدارة المستخدمين" desc="بحث، إيقاف/تفعيل، وتغيير الأدوار — كل إجراء يسجل في سجل التدقيق والإشراف" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" /> بحث وفلترة
          </CardTitle>
          <CardDescription>ابحث بالاسم أو اسم المستخدم، وفلتر حسب الدور والحالة</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2">
            <Input name="q" defaultValue={q} placeholder="بحث بالاسم أو username…" className="h-9 w-56" />
            <select name="role" defaultValue={role} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">كل الأدوار</option>
              <option value="researcher">باحثون</option>
              <option value="company">شركات</option>
              <option value="moderator">مشرفون</option>
              <option value="admin">مدراء</option>
            </select>
            <select name="active" defaultValue={active} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">كل الحالات</option>
              <option value="active">نشطون</option>
              <option value="suspended">موقوفون</option>
            </select>
            <Button size="sm" variant="outline" type="submit">
              بحث
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error.message}</p>}
        </CardContent>
      </Card>

      {!users?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">لا يوجد مستخدمون يطابقون البحث (أو RLS يقيّد العرض — للإدارة فقط).</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{users.length} مستخدم — الأحدث أولًا</p>
          {users.map((u) => {
            const roles = rolesMap[u.id] ?? [];
            return (
              <Card key={u.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold" dir="ltr">
                          {u.username}
                        </span>
                        {u.is_active ? <Badge>نشط</Badge> : <Badge variant="destructive">موقوف</Badge>}
                        {roles.map((r) => (
                          <form key={r} action={removeRole.bind(null, u.id, r)} className="inline-flex">
                            <Badge variant="outline" className="gap-1">
                              {r}
                              <button type="submit" className="mr-1 rounded-full p-0.5 hover:bg-muted" aria-label={`إزالة ${r}`}>
                                ×
                              </button>
                            </Badge>
                          </form>
                        ))}
                        {!roles.length && <Badge variant="secondary">بلا دور</Badge>}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">{u.full_name ?? '—'}</p>
                      <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                        {u.id} · {new Date(u.created_at).toLocaleDateString('ar-EG')}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 lg:w-[420px] lg:shrink-0">
                      <form action={setActive.bind(null, u.id, !u.is_active)} className="flex gap-2">
                        <Input name={`reason_${u.id}`} placeholder={u.is_active ? 'سبب الإيقاف' : 'سبب التفعيل'} className="h-8 flex-1 text-xs" />
                        <Button size="sm" variant={u.is_active ? 'destructive' : 'default'} type="submit" className="shrink-0">
                          <ShieldAlert className="ml-1 h-3 w-3" />
                          {u.is_active ? 'إيقاف' : 'تفعيل'}
                        </Button>
                      </form>

                      <form action={changeRole.bind(null, u.id)} className="flex gap-2">
                        <select name={`role_${u.id}`} defaultValue="" className="h-8 flex-1 rounded-md border bg-background px-2 text-xs">
                          <option value="" disabled>
                            تغيير الدور…
                          </option>
                          <option value="researcher">researcher</option>
                          <option value="company">company</option>
                          <option value="moderator">moderator</option>
                          <option value="admin">admin</option>
                        </select>
                        <Input name={`reason_${u.id}`} placeholder="السبب (اختياري)" className="h-8 w-24 text-xs lg:w-28" />
                        <Button size="sm" variant="outline" type="submit">
                          <UserCog className="ml-1 h-3 w-3" /> حفظ الدور
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
