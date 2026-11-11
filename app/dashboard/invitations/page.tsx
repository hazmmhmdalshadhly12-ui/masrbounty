import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth/guard';
import { getMyPendingInvitations } from '@/lib/teams/queries';
import { respondTeamInvitationAction } from '@/features/teams/actions';
import { respondCompanyInvitationAction } from '@/features/teams/company-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import {
  COMPANY_PERMISSION_LABELS,
  COMPANY_ROLE_LABELS_AR,
  TEAM_PERMISSION_LABELS,
  TEAM_ROLE_LABELS,
  invitationStatusLabel,
  isInvitationAcceptable,
  type InvitationStatus,
  type TeamMemberRole,
} from '@/lib/teams/permissions';
import { Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MyInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  await requireSession({ next: '/dashboard/invitations' });
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user!.id;
  const email = (user.user?.email ?? '').toLowerCase();
  if (!email) redirect('/login');
  const invitations = await getMyPendingInvitations(email, uid);

  return (
    <div className="container max-w-3xl space-y-6 py-8" dir="rtl">
      <PageHeader icon={Inbox} title="دعواتي" desc="دعوات الانضمام إلى فرق الباحثين وفرق الشركات — القبول يتم ببريد الحساب نفسه فقط." />

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
          <CardTitle className="text-sm">كل الدعوات ({invitations.length})</CardTitle>
          <CardDescription>
            اسم الفريق، نوعه، الداعي، تاريخ الدعوة، والدور المقترح — الدعوة المنتهية أو الملغاة لا يمكن قبولها.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {invitations.map((i) => {
            const acceptable = isInvitationAcceptable({ status: i.status, expires_at: i.expiresAt });
            const roleLabel =
              i.kind === 'company'
                ? (COMPANY_ROLE_LABELS_AR[i.role] ?? i.role)
                : (TEAM_ROLE_LABELS[i.role as TeamMemberRole] ?? i.role);
            const grantList = Array.isArray((i.permissions as { grant?: string[] })?.grant)
              ? (i.permissions as { grant: string[] }).grant
              : [];
            return (
              <div
                key={`${i.kind}-${i.id}`}
                className={`rounded-lg border px-3 py-2.5 ${acceptable ? '' : 'opacity-70'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {i.targetName}{' '}
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                        {i.kind === 'company' ? 'فريق شركة' : 'فريق باحثين'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      الدور: {roleLabel} · وصلت {new Date(i.createdAt).toLocaleDateString('ar-EG')} · تنتهي{' '}
                      {new Date(i.expiresAt).toLocaleDateString('ar-EG')}
                      {i.invitedByName ? ` · دعاك ${i.invitedByName}` : ''} · للبريد {i.invitedByEmail}
                    </p>
                    {grantList.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        صلاحيات مقترحة:{' '}
                        {grantList
                          .map(
                            (p) =>
                              (i.kind === 'company'
                                ? COMPANY_PERMISSION_LABELS[p as keyof typeof COMPANY_PERMISSION_LABELS]
                                : TEAM_PERMISSION_LABELS[p as keyof typeof TEAM_PERMISSION_LABELS]) ?? p
                          )
                          .join('، ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {acceptable ? (
                      i.kind === 'company' ? (
                        <>
                          <form action={respondCompanyInvitationAction}>
                            <input type="hidden" name="invitation_id" value={i.id} />
                            <input type="hidden" name="accept" value="1" />
                            <Button type="submit" size="sm" className="h-8 text-xs">قبول</Button>
                          </form>
                          <form action={respondCompanyInvitationAction}>
                            <input type="hidden" name="invitation_id" value={i.id} />
                            <Button type="submit" variant="outline" size="sm" className="h-8 border-red-200 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
                              رفض
                            </Button>
                          </form>
                        </>
                      ) : (
                        <>
                          <form action={respondTeamInvitationAction}>
                            <input type="hidden" name="invitation_id" value={i.id} />
                            <input type="hidden" name="accept" value="1" />
                            <Button type="submit" size="sm" className="h-8 text-xs">قبول</Button>
                          </form>
                          <form action={respondTeamInvitationAction}>
                            <input type="hidden" name="invitation_id" value={i.id} />
                            <Button type="submit" variant="outline" size="sm" className="h-8 border-red-200 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
                              رفض
                            </Button>
                          </form>
                        </>
                      )
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {invitationStatusLabel(i.status as InvitationStatus)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!invitations.length && (
            <EmptyState
              title="لا توجد دعوات"
              hint="عندما يدعوك قائد فريق أو شركة بالبريد المسجّل لديك، ستجد الدعوة هنا وتصلك إشعارات المنصة."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/member">لوحة العضويات</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
