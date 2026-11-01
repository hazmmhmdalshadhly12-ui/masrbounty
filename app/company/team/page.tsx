import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/notify';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { CopyButton } from '@/components/shared/copy-button';
import { Avatar } from '@/components/shared/avatar';
import { StatusPill } from '@/components/shared/status-pill';
import { Users, UserPlus, Building2 } from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

const ROLE_AR: Record<string, string> = {
  owner: 'مؤسس',
  admin: 'مدير',
  finance: 'مالية',
  triager: 'فرز',
  analyst: 'محلل',
  viewer: 'مشاهد',
};

function inviteLink(token: string, host: string | null, proto: string): string {
  // Built from the live request host so links work on previews and prod alike;
  // falls back to the canonical SITE_URL when no host header is present.
  const origin = host ? `${proto}://${host}` : SITE_URL;
  return `${origin}/company/team/accept?token=${encodeURIComponent(token)}`;
}

async function invite(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login?next=%2Fcompany%2Fteam');
  const companyId = String(formData.get('company_id') ?? '');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'viewer');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect('/company/team?error=' + encodeURIComponent('بريد إلكتروني غير صالح'));
  }
  if (!['viewer', 'triager', 'analyst', 'finance', 'admin'].includes(role)) {
    redirect('/company/team?error=' + encodeURIComponent('دور غير صالح'));
  }
  // Only owners and company admins may invite (never triagers/viewers/others)
  const { data: company } = await supabase.from('company_profiles').select('owner_id').eq('id', companyId).single();
  const { data: mine } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.user.id)
    .single();
  const myRole = company?.owner_id === user.user.id ? 'owner' : (mine as { role: string } | null)?.role;
  if (myRole !== 'owner' && myRole !== 'admin') {
    redirect('/company/team?error=' + encodeURIComponent('الدعوات متاحة للمؤسس والمدراء فقط'));
  }
  // Prevent duplicate pending invites for the same email
  const { data: existing } = await supabase
    .from('company_invitations')
    .select('id,accepted_at')
    .eq('company_id', companyId)
    .eq('email', email)
    .is('accepted_at', null)
    .limit(1);
  if ((existing ?? []).length > 0) {
    redirect('/company/team?error=' + encodeURIComponent('توجد دعوة معلقة بالفعل لهذا البريد'));
  }
  const { error } = await supabase.from('company_invitations').insert({ company_id: companyId, email, role });
  if (error) redirect('/company/team?error=' + encodeURIComponent('تعذر إنشاء الدعوة — حاول مجددًا'));
  // Audit: let the current team know a new invite exists (invitee is reached
  // by sharing the accept link — resolved on the invitation card below)
  try {
    const { data: cm } = await supabase.from('company_members').select('user_id').eq('company_id', companyId);
    for (const m of (cm ?? []) as { user_id: string }[]) {
      if (m.user_id !== user.user!.id) {
        await notify(supabase, m.user_id, {
          type: 'system',
          title: `دعوة جديدة للفريق: ${email}`,
          body: `الدور: ${ROLE_AR[role] ?? role}`,
          link: '/company/team',
        });
      }
    }
    if (company?.owner_id && company.owner_id !== user.user!.id) {
      await notify(supabase, company.owner_id, {
        type: 'system',
        title: `دعوة جديدة للفريق: ${email}`,
        body: `الدور: ${ROLE_AR[role] ?? role}`,
        link: '/company/team',
      });
    }
  } catch {
    /* notify best-effort */
  }
  revalidatePath('/company/team');
  redirect('/company/team?ok=' + encodeURIComponent('تم إنشاء الدعوة — شارك رابط القبول مع العضو'));
}

type MemberRow = {
  id: string;
  role: string;
  joined_at: string;
  user_id: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login?next=%2Fcompany%2Fteam');
  const uid = user.user.id;

  // Viewable companies = owned + membership (company admins can manage their team too)
  const [{ data: owned }, { data: memberships }] = await Promise.all([
    supabase.from('company_profiles').select('id,name').eq('owner_id', uid),
    supabase.from('company_members').select('company_id,role').eq('user_id', uid),
  ]);
  const ownedList = (owned ?? []) as { id: string; name: string }[];
  const memberCompanyIds = [...new Set((memberships ?? []).map((m: { company_id: string }) => m.company_id))];
  const { data: memberCompaniesRaw } = memberCompanyIds.length
    ? await supabase.from('company_profiles').select('id,name').in('id', memberCompanyIds)
    : { data: [] };
  const memberCompanies = (memberCompaniesRaw ?? []) as { id: string; name: string }[];
  const companies = [...new Map([...ownedList, ...memberCompanies].map((c) => [c.id, c])).values()];

  if (!companies.length) {
    return (
      <div className="container py-8" dir="rtl">
        <PageHeader icon={Users} title="فريق الشركة" desc="أعضاء فريقك وصلاحياتهم ودعواتهم المعلقة." />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          hint="أنشئ ملف شركتك أولًا ثم ابدأ بدعوة أعضاء الفريق للتعاون على برامجك."
          action={
            <Button asChild>
              <Link href="/company/onboarding">إنشاء شركة</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const companyId = companies[0].id;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const [{ data: membersRaw }, { data: invitesRaw }, { data: companyRow }] = await Promise.all([
    supabase
      .from('company_members')
      .select('id,role,joined_at,user_id,profiles!company_members_user_id_fkey(username,full_name,avatar_url)')
      .eq('company_id', companyId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('company_invitations')
      .select('id,email,role,token,expires_at,accepted_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('company_profiles')
      .select('owner_id, profiles!company_profiles_owner_id_fkey(username,full_name,avatar_url)')
      .eq('id', companyId)
      .single(),
  ]);

  const members = ((membersRaw ?? []) as unknown) as MemberRow[];
  const invites = ((invitesRaw ?? []) as unknown) as InviteRow[];
  const owner = (companyRow as unknown as {
    owner_id: string;
    profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
  } | null) ?? null;

  // Manageable = owner or company-admin membership of THIS company
  const myMembershipRole = (memberships ?? []).find(
    (m: { company_id: string; role: string }) => m.company_id === companyId
  )?.role;
  const canManage = ownedList.some((c) => c.id === companyId) || myMembershipRole === 'admin';
  const nowIso = new Date().toISOString();

  return (
    <div className="container max-w-3xl py-8 space-y-6" dir="rtl">
      <PageHeader icon={Users} title="فريق الشركة" desc="أعضاء فريقك وصلاحياتهم ودعواتهم المعلقة." />

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
          <CardTitle className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" /> {companies[0].name} — الأعضاء ({members.length + 1})
          </CardTitle>
          <CardDescription>المؤسس وأعضاء الفريق وأدوار كل منهم في هذه الشركة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {owner && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={owner.profiles?.username ?? '؟'}
                  src={owner.profiles?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{owner.profiles?.full_name || owner.profiles?.username}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    @{owner.profiles?.username}
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {ROLE_AR.owner}
              </span>
            </div>
          )}
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={m.profiles?.username ?? '؟'}
                  src={m.profiles?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.profiles?.full_name || m.profiles?.username || 'مستخدم محذوف'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {m.profiles ? `@${m.profiles.username}` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  انضم {new Date(m.joined_at).toLocaleDateString('ar-EG')}
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                  {ROLE_AR[m.role] ?? m.role}
                </span>
              </div>
            </div>
          ))}
          {!members.length && <p className="py-2 text-sm text-muted-foreground">لا يوجد أعضاء بعد — ابدأ بدعوة فريقك.</p>}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4" /> دعوة عضو جديد
            </CardTitle>
            <CardDescription>
              أنشئ دعوة ببريد زميلك، ثم شاركه «رابط القبول» — ينضم بضغطة واحدة بعد تسجيل الدخول بنفس البريد.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={invite} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="company_id" value={companyId} />
              <Input name="email" type="email" required placeholder="colleague@company.com" dir="ltr" className="max-w-xs" />
              <select name="role" className="h-10 rounded-md border bg-card px-2 text-sm dark:border-slate-700">
                <option value="viewer">{ROLE_AR.viewer} — قراءة فقط</option>
                <option value="triager">{ROLE_AR.triager} — فرز التقارير</option>
                <option value="analyst">{ROLE_AR.analyst} — تحليلات</option>
                <option value="finance">{ROLE_AR.finance} — المدفوعات</option>
                <option value="admin">{ROLE_AR.admin} — إدارة كاملة</option>
              </select>
              <Button type="submit">إنشاء الدعوة</Button>
            </form>

            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold">الدعوات ({invites.length})</p>
                {invites.map((i) => {
                  const expired = i.expires_at < nowIso;
                  const status = i.accepted_at ? 'accepted' : expired ? 'expired' : 'pending';
                  return (
                    <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" dir="ltr">
                          {i.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          الدور: {ROLE_AR[i.role] ?? i.role} · تنتهي {new Date(i.expires_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'accepted' ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            مقبولة ✓
                          </span>
                        ) : status === 'expired' ? (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            منتهية
                          </span>
                        ) : (
                          <>
                            <CopyButton text={inviteLink(i.token, host, proto)} label="نسخ رابط القبول" />
                            <StatusPill value="pending" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            يمكنك عرض الفريق فقط — إدارة الدعوات متاحة للمؤسس والمدراء.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
