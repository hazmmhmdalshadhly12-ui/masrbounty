import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { notify } from '@/lib/notify';
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

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from('company_invitations')
    .select('id,company_id,email,role,expires_at,accepted_at')
    .eq('token', token)
    .maybeSingle();
  const invitation = inv as
    | { id: string; company_id: string; email: string; role: string; expires_at: string; accepted_at: string | null }
    | null;

  if (!invitation) {
    redirect('/company/team/accept?token=' + encodeURIComponent(token) + '&e=' + encodeURIComponent('رابط الدعوة غير صالح'));
  }
  if (invitation.accepted_at) {
    redirect('/company/team/accept?token=' + encodeURIComponent(token) + '&e=' + encodeURIComponent('تم استخدام هذه الدعوة بالفعل'));
  }
  if (new Date(invitation.expires_at) < new Date()) {
    redirect('/company/team/accept?token=' + encodeURIComponent(token) + '&e=' + encodeURIComponent('انتهت صلاحية الدعوة — اطلب دعوة جديدة من مدير الشركة'));
  }
  const userEmail = (user.user?.email ?? '').toLowerCase();
  if (!userEmail || userEmail !== invitation.email.toLowerCase()) {
    redirect(
      '/company/team/accept?token=' +
        encodeURIComponent(token) +
        '&e=' +
        encodeURIComponent(`هذه الدعوة صادرة للبريد ${invitation.email} — سجّل الدخول بنفس البريد للانضمام`)
    );
  }

  // Already a member? Just go to the team page.
  const { data: existing } = await admin
    .from('company_members')
    .select('id')
    .eq('company_id', invitation.company_id)
    .eq('user_id', user.user!.id)
    .maybeSingle();
  if (!existing) {
    const { error: insertErr } = await admin.from('company_members').insert({
      company_id: invitation.company_id,
      user_id: user.user!.id,
      role: invitation.role,
    });
    if (insertErr) {
      redirect('/company/team/accept?token=' + encodeURIComponent(token) + '&e=' + encodeURIComponent('تعذر إضافتك للفريق — تواصل مع مدير الشركة'));
    }
  }
  await admin.from('company_invitations').update({ accepted_at: new Date().toISOString() }).eq('id', invitation.id);
  // Notify the team owner that the invite was accepted
  try {
    const { data: company } = await admin
      .from('company_profiles')
      .select('owner_id,name')
      .eq('id', invitation.company_id)
      .maybeSingle();
    if (company?.owner_id) {
      await notify(supabase, company.owner_id, {
        type: 'system',
        title: `انضم عضو جديد إلى فريق ${company.name}`,
        body: `قَبِل الدعوة بدور ${ROLE_AR[invitation.role] ?? invitation.role}`,
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
    const { data: inv } = await admin
      .from('company_invitations')
      .select('email,role,expires_at,accepted_at,company_profiles(name)')
      .eq('token', token)
      .maybeSingle();
    const row = inv as
      | { email: string; role: string; expires_at: string; accepted_at: string | null; company_profiles: { name: string } | null }
      | null;
    if (row) {
      const state = row.accepted_at ? 'accepted' : new Date(row.expires_at) < new Date() ? 'expired' : 'pending';
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
