import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export type NotifyType =
  | 'report'
  | 'comment'
  | 'bounty'
  | 'payment'
  | 'program'
  | 'message'
  | 'system'
  | 'dispute'
  | 'badge';

/**
 * Best-effort in-app notification. Never throws.
 * Authorization is enforced by CALLERS (they resolve recipients from data
 * the caller is allowed to see). The insert itself uses the service role
 * because RLS intentionally forbids users from writing to each other's
 * inboxes — otherwise anyone could spam anyone.
 */
export async function notify(
  _db: SupabaseClient,
  userId: string,
  n: { type: NotifyType; title: string; body?: string; link?: string }
): Promise<void> {
  try {
    if (!userId) return;
    const db = createAdminClient();
    await db.from('notifications').insert({
      user_id: userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
    });
  } catch {
    /* notifications must never break the primary action */
  }
}

/** All researcher user_ids + company member user_ids attached to a report. */
export async function reportParties(
  db: SupabaseClient,
  reportId: string
): Promise<{ reporterUserId: string | null; memberUserIds: string[]; reportNumber: string; programId: string }> {
  const empty = { reporterUserId: null as string | null, memberUserIds: [] as string[], reportNumber: '', programId: '' };
  try {
    const { data: r } = await db
      .from('reports')
      .select('report_number,program_id,researcher_id,researcher_profiles!inner(user_id)')
      .eq('id', reportId)
      .single();
    if (!r) return empty;
    const reporterUserId = (r as unknown as { researcher_profiles: { user_id: string } }).researcher_profiles?.user_id ?? null;
    const { data: prog } = await db.from('programs').select('company_id').eq('id', r.program_id).single();
    let memberUserIds: string[] = [];
    if (prog) {
      const { data: members } = await db.from('company_members').select('user_id').eq('company_id', (prog as { company_id: string }).company_id);
      memberUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    }
    return { reporterUserId, memberUserIds, reportNumber: r.report_number, programId: r.program_id };
  } catch {
    return empty;
  }
}

/** Notify all members of a company (owner + members) — used for program publish. */
export async function notifyCompanyMembers(
  db: SupabaseClient,
  companyId: string,
  payload: { type: NotifyType; title: string; body?: string; link?: string }
): Promise<void> {
  try {
    const { data: company } = await db.from('company_profiles').select('owner_id').eq('id', companyId).maybeSingle();
    const ownerId = (company as { owner_id: string } | null)?.owner_id ?? null;
    const { data: members } = await db.from('company_members').select('user_id').eq('company_id', companyId);
    const ids = new Set<string>();
    if (ownerId) ids.add(ownerId);
    for (const m of (members ?? []) as { user_id: string }[]) ids.add(m.user_id);
    for (const uid of ids) await notify(db, uid, payload);
  } catch {
    /* best-effort */
  }
}

/** Program published — notify company team + optional broadcast. */
export async function notifyProgramPublished(
  db: SupabaseClient,
  program: { id: string; slug: string; name: string; company_id: string }
): Promise<void> {
  try {
    await notifyCompanyMembers(db, program.company_id, {
      type: 'program',
      title: `تم نشر البرنامج: ${program.name}`,
      body: 'برنامجك الآن نشط ومرئي للباحثين',
      link: `/programs/${program.slug}`,
    });
    // optional: notify admins/moderators via audit channel — best effort no-op if no admin ids
    const { data: staff } = await db.from('user_roles').select('user_id').in('role', ['admin', 'moderator']).limit(20);
    for (const s of (staff ?? []) as { user_id: string }[]) {
      await notify(db, s.user_id, {
        type: 'program',
        title: `برنامج منشور: ${program.name}`,
        body: `Slug: ${program.slug}`,
        link: `/programs/${program.slug}`,
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Report status changed — notify reporter + company triagers. */
export async function notifyReportStatusChanged(
  db: SupabaseClient,
  reportId: string,
  from: string,
  to: string
): Promise<void> {
  try {
    const parties = await reportParties(db, reportId);
    const titleAr =
      to === 'accepted' ? `تم قبول بلاغك ${parties.reportNumber}` :
      to === 'resolved' ? `تم حل بلاغك ${parties.reportNumber}` :
      to === 'triaged' ? `بلاغك قيد الفرز ${parties.reportNumber}` :
      to === 'duplicate' ? `بلاغك مكرر ${parties.reportNumber}` :
      to === 'closed' ? `تم إغلاق بلاغك ${parties.reportNumber}` :
      `تحديث حالة بلاغك ${parties.reportNumber}: ${to}`;
    if (parties.reporterUserId) {
      await notify(db, parties.reporterUserId, {
        type: 'report',
        title: titleAr,
        body: from ? `من ${from} إلى ${to}` : `الحالة الجديدة: ${to}`,
        link: `/dashboard/reports/${reportId}`,
      });
    }
    for (const uid of parties.memberUserIds) {
      await notify(db, uid, {
        type: 'report',
        title: `تحديث بلاغ ${parties.reportNumber}: ${from} → ${to}`,
        link: `/company/reports/${reportId}`,
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Bounty awarded — notify reporter. */
export async function notifyBountyAwarded(
  db: SupabaseClient,
  reportId: string,
  amount: number
): Promise<void> {
  try {
    const parties = await reportParties(db, reportId);
    if (parties.reporterUserId) {
      await notify(db, parties.reporterUserId, {
        type: 'bounty',
        title: `تم اعتماد مكافأة ${amount} جنيه لبلاغك ${parties.reportNumber}`,
        body: 'المكافأة مقيدة وستظهر في محفظتك عند الدفع',
        link: '/dashboard/payments',
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Bounty payment completed — notify reporter. */
export async function notifyBountyPaid(
  db: SupabaseClient,
  reportId: string,
  reference: string
): Promise<void> {
  try {
    const parties = await reportParties(db, reportId);
    if (parties.reporterUserId) {
      await notify(db, parties.reporterUserId, {
        type: 'payment',
        title: `تم دفع المكافأة — مرجع ${reference}`,
        body: `بلاغ ${parties.reportNumber}`,
        link: '/dashboard/payments',
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Payout request lifecycle — notify researcher. */
export async function notifyPayoutStatus(
  db: SupabaseClient,
  researcherUserId: string,
  status: 'approved' | 'rejected' | 'completed',
  amount?: number,
  reference?: string
): Promise<void> {
  try {
    const title =
      status === 'approved' ? `تمت الموافقة على سحب ${amount ?? ''} جنيه — قيد التحويل` :
      status === 'rejected' ? 'تم رفض طلب السحب' :
      `تم إرسال مستحقاتك — مرجع ${reference ?? ''}`;
    await notify(db, researcherUserId, {
      type: 'payment',
      title,
      link: '/dashboard/payments',
    });
  } catch {
    /* best-effort */
  }
}
