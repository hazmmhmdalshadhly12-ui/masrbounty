import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { notify } from '@/lib/notify';
import { invitationTokenHash } from '@/lib/teams/token';
import { UserCheck, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ROLE_AR: Record<string, string> = {
  owner: 'مؤسس',
  admin: 'مدير',
  finance: 'مالية',
  triager: 'فرز',
  analyst: 'محلل',
  viewer: 'مشاهد',
};

async function acceptInvite(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login?next=' + encodeURIComponent(`/company/team/accept?token=${token}`));

  // The RPC re-validates: status, expiry, email match, capacity — atomically.
  const { error } = await supabase.rpc('fn_respond_company_invitation', {
    p_token: token,
    p_accept: true,
    p_invitation_id: null,
  });
  if (error) {
    const raw = error.message;
    const msg =
      /expired/.test(raw) ? 'انتهت صلاحية الدعوة — اطلب دعوة جديدة من مدير الشركة' :
      /different email/.test(raw) ? 'هذه الدعوة صادرة لبريد مختلف — سجّل الدخول بنفس البريد للانضمام' :
      /invitation is/.test(raw) ? 'تم استخدام هذه الدعوة بالفعل' :
      /not found/.test(raw) ? 'رابط الدعوة غير صالح' :
      'تعذر إضافتك للفريق — تواصل مع مدير الشركة';
    redirect('/company/team/accept?token=' + encodeURIComponent(token) + '&e=' + encodeURIComponent(msg));
  }

  // Notify the team owner that the invite was accepted
  try {
    const admin = createAdminClient();
    const hash = await invitationTokenHash(token);
    const { data: invRow } = await admin
      .from('company_invitations')
      .select('company_id,role,company_profiles(name,owner_id)')
      .or(`token_hash.eq.${hash},token.eq.${token}`)
      .maybeSingle();
    const row = invRow as
      | { company_id: string; role: string; company_profiles: { name: string; owner_id: string } | null }
      | null;
    if (row?.company_profiles?.owner_id) {
      await notify(supabase, row.company_profiles.owner_id, {
        type: 'team',
        title: `انضم عضو جديد إلى فريق ${row.company_profiles.name}`,
        body: `قَبِل الدعوة بدور ${ROLE_AR[row.role] ?? row.role}`,
        link: '/company/team',
      });
    }
  } catch {
    /* best-effort */
  }
  redirect('/company/team');
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? '';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) {
    return (
      <div className="container max-w-lg py-12" dir="rtl">
        <PageHeader icon={UserCheck} title="قبول دعوة الفريق" desc="خطوة واحدة تفصلك عن الانضمام." />
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">سجّل الدخول أولًا (بنفس البريد المُرسلة إليه الدعوة) لقبول الانضمام.</p>
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(`/company/team/accept?token=${token}`)}`}>تسجيل الدخول</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged-in: resolve invitation via service role (invitee cannot read it under RLS)
  let invitation:
    | { company_name: string; email: string; role: string; state: 'pending' | 'accepted' | 'expired' | 'invalid' }
    | null = null;
  try {
    const admin = createAdminClient();
    const hash = await invitationTokenHash(token);
    const { data: inv } = await admin
      .from('company_invitations')
      .select('email,role,expires_at,accepted_at,status,company_profiles(name)')
      .or(`token_hash.eq.${hash},token.eq.${token}`)
      .maybeSingle();
    const row = inv as
      | { email: string; role: string; expires_at: string; accepted_at: string | null; status: string | null; company_profiles: { name: string } | null }
      | null;
    if (row) {
      const expired = new Date(row.expires_at) < new Date();
      const state =
        row.status === 'accepted' || row.accepted_at ? 'accepted'
        : row.status === 'expired' || expired ? 'expired'
        : row.status === 'pending' || !row.status ? 'pending'
        : 'invalid';
      invitation = { company_name: row.company_profiles?.name ?? 'شركة', email: row.email, role: row.role, state };
    } else {
      invitation = { company_name: '', email: '', role: '', state: 'invalid' };
    }
  } catch {
    invitation = { company_name: '', email: '', role: '', state: 'invalid' };
  }

  if (!invitation || invitation.state === 'invalid') {
    return (
      <div className="container max-w-lg py-12" dir="rtl">
        <PageHeader icon={ShieldAlert} title="قبول دعوة الفريق" />
        <EmptyState
          title="رابط الدعوة غير صالح"
          hint="تأكد من الرابط الكامل كما أرسله لك مدير الشركة، أو اطلب دعوة جديدة."
        />
      </div>
    );
  }

  return (
    <div className="container max-w-lg py-12" dir="rtl">
      <PageHeader icon={UserCheck} title="قبول دعوة الفريق" desc="مراجعة الدعوة قبل الانضمام." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">دعوة للانضمام إلى: {invitation.company_name}</CardTitle>
          <CardDescription dir="ltr">{invitation.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            الدور الممنوح: <b>{ROLE_AR[invitation.role] ?? invitation.role}</b>
          </p>
          {invitation.state === 'accepted' && (
            <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground">
              هذه الدعوة مستخدمة بالفعل — إن كنت عضوًا، توجّه إلى صفحة الفريق.
            </p>
          )}
          {invitation.state === 'expired' && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              انتهت صلاحية الدعوة — اطلب من مدير الشركة إنشاء دعوة جديدة.
            </p>
          )}
          {sp.e && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {sp.e}
            </p>
          )}
          {invitation.state === 'pending' && (
            <>
              <p className="text-muted-foreground">
                أنت مسجّل الدخول بالبريد{' '}
                <span dir="ltr" className="font-medium text-foreground">
                  {user.user?.email}
                </span>
                . بالقبول ستنضم لفريق الشركة بالدور المذكور أعلاه.
              </p>
              <form action={acceptInvite}>
                <input type="hidden" name="token" value={token} />
                <Button type="submit" className="w-full">
                  قبول الدعوة والانضمام
                </Button>
              </form>
            </>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href="/company/team">الانتقال إلى صفحة الفريق</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
