'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { programSchema } from '@/schemas/program';
import { slugify } from '@/utils/slug';
import { enforceRate } from '@/lib/rate-limit';
import { notify } from '@/lib/notify';

type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

export type PublishReadiness = { ready: boolean; missing: string[] };

// Strict state machine: draft→active (publish), active→paused, paused→active, active→closed, paused→closed, draft→closed
// Also pending_review→active/closed if the enum exists. No other transitions allowed.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'closed'],
  pending_review: ['active', 'closed'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: [],
};

function assertTransition(current: string, target: string): void {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    throw new Error(`الانتقال غير مسموح من الحالة "${current}" إلى "${target}"`);
  }
}

async function notifyCompanyMembers(
  supabase: SupabaseClient,
  companyId: string,
  payload: { title: string; body?: string; link?: string },
) {
  try {
    const { data: company } = await supabase.from('company_profiles').select('owner_id').eq('id', companyId).single();
    const ownerId = (company as { owner_id: string } | null)?.owner_id;
    const { data: members } = await supabase.from('company_members').select('user_id').eq('company_id', companyId);
    const ids = new Set<string>();
    if (ownerId) ids.add(ownerId);
    for (const m of (members ?? []) as { user_id: string }[]) ids.add(m.user_id);
    for (const uid of ids) {
      await notify(supabase, uid, { type: 'program', title: payload.title, body: payload.body, link: payload.link });
    }
  } catch {
    /* notify best-effort */
  }
}

export async function createProgramAction(formData: FormData) {
  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug') || slugify(String(formData.get('name') ?? '')),
    description: formData.get('description'),
    // default visibility='public' — RLS respects it via can_view_program (security agent handles RLS, note only)
    visibility: formData.get('visibility') || 'public',
    scope: formData.get('scope'),
    contact_email: formData.get('contact_email'),
  };
  const parsed = programSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'بيانات البرنامج غير صالحة');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('غير مصرح');
  enforceRate(`program:${user.user.id}`, 10, 3_600_000);
  const { data: company } = await supabase
    .from('company_profiles')
    .select('id')
    .eq('owner_id', user.user.id)
    .single();
  if (!company) throw new Error('أنشئ ملف الشركة أولاً');
  const { data: program, error } = await supabase
    .from('programs')
    // visibility defaults to 'public' in DB; explicit here for clarity. RLS visibility handling is enforced via can_view_program.
    .insert({ ...parsed.data, company_id: company.id, created_by: user.user.id, status: 'draft' })
    .select('id')
    .single();
  if (error || !program) throw new Error(error?.message ?? 'فشل إنشاء البرنامج');
  revalidatePath('/company/programs');
  redirect(`/company/programs/${program.id}`);
}

/** Resolve the caller's company (owner or member) or throw. */
async function requireCompany(supabase: SupabaseClient, userId: string) {
  const { data: owned } = await supabase
    .from('company_profiles')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  if (owned) return owned.id as string;
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error('الوصول للشركة مطلوب');
  return membership.company_id as string;
}

async function requireOwnedProgram(
  supabase: SupabaseClient,
  userId: string,
  programId: string,
) {
  const companyId = await requireCompany(supabase, userId);
  const { data: program, error } = await supabase
    .from('programs')
    .select('id, company_id, status')
    .eq('id', programId)
    .eq('company_id', companyId)
    .single();
  if (error || !program) throw new Error('البرنامج غير موجود أو ليس لديك صلاحية');
  return program as { id: string; company_id: string; status: string };
}

/**
 * Check if a program is ready to be published.
 * Verifies:
 *  a) company has at least one verified domain (company_domains verified+not expired OR legacy domain_verifications)
 *  b) required fields & related records
 */
export async function checkPublishReadiness(
  supabase: SupabaseClient,
  programId: string,
): Promise<PublishReadiness> {
  const missing: string[] = [];

  const { data: program, error: progErr } = await supabase
    .from('programs')
    .select('id, company_id, name, description, scope, contact_email')
    .eq('id', programId)
    .single();

  if (progErr || !program) {
    throw new Error('البرنامج غير موجود');
  }

  const p = program as {
    id: string;
    company_id: string;
    name: string | null;
    description: string | null;
    scope: string | null;
    contact_email: string | null;
  };

  // a) verified domain check
  let hasVerifiedDomain = false;

  // Try new table company_domains (status=verified and expires_at > now)
  try {
    const { data, error } = await supabase
      .from('company_domains')
      .select('id, status, expires_at')
      .eq('company_id', p.company_id)
      .eq('status', 'verified')
      .limit(10);
    if (!error && data && data.length > 0) {
      const now = new Date();
      hasVerifiedDomain = (data as { expires_at: string | null }[]).some((r) => {
        if (!r.expires_at) return true;
        return new Date(r.expires_at) > now;
      });
    }
  } catch {
    // table may not exist yet — fall through to legacy
  }

  if (!hasVerifiedDomain) {
    // Legacy fallback: domain_verifications where status=verified
    const { data, error } = await supabase
      .from('domain_verifications')
      .select('id')
      .eq('company_id', p.company_id)
      .eq('status', 'verified')
      .limit(1);
    if (!error && data && data.length > 0) {
      hasVerifiedDomain = true;
    }
  }

  if (!hasVerifiedDomain) {
    missing.push('الشركة تحتاج دومين موثّق (لم يتم التحقق من أي دومين — status=verified)');
  }

  // b) required fields
  if (!p.name || p.name.trim().length < 3) {
    missing.push('اسم البرنامج مطلوب (3 أحرف على الأقل)');
  }
  if (!p.description || p.description.trim().length < 50) {
    missing.push('وصف البرنامج مطلوب ويجب أن يكون 50 حرفًا على الأقل');
  }
  if (!p.scope || p.scope.trim().length === 0) {
    missing.push('نطاق البرنامج (scope) مطلوب');
  }
  if (!p.contact_email || p.contact_email.trim().length === 0) {
    missing.push('البريد الإلكتروني للتواصل مطلوب');
  }

  const [{ count: assetsCount }, { count: rulesCount }, { count: bountyCount }] = await Promise.all([
    supabase.from('program_assets').select('id', { count: 'exact', head: true }).eq('program_id', programId),
    supabase.from('program_rules').select('id', { count: 'exact', head: true }).eq('program_id', programId),
    supabase.from('bounty_policies').select('id', { count: 'exact', head: true }).eq('program_id', programId),
  ]);

  if (!assetsCount || assetsCount === 0) {
    missing.push('يجب إضافة أصل واحد على الأقل (Assets)');
  }
  if (!rulesCount || rulesCount === 0) {
    missing.push('يجب إضافة قاعدة واحدة على الأقل (Rules)');
  }
  if (!bountyCount || bountyCount === 0) {
    missing.push('يجب إضافة سياسة مكافآت واحدة على الأقل (Bounty Policy)');
  }

  return { ready: missing.length === 0, missing };
}

/** Helper for UI to show readiness without throwing */
export async function canPublishProgram(programId: string): Promise<PublishReadiness> {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('غير مصرح');
  await requireOwnedProgram(supabase, user.user.id, programId);
  return checkPublishReadiness(supabase, programId);
}

async function doTransition(programId: string, target: 'draft' | 'active' | 'paused' | 'closed') {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('غير مصرح');
  const program = await requireOwnedProgram(supabase, user.user.id, programId);
  const current = program.status as string;
  assertTransition(current, target);
  // Going to active (publish or resume) must be fully ready — re-check gate
  if (target === 'active') {
    const readiness = await checkPublishReadiness(supabase, programId);
    if (!readiness.ready) {
      throw new Error(`البرنامج غير جاهز للنشر:\n- ${readiness.missing.join('\n- ')}`);
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: target };
  if (target === 'active') {
    updates['published_at'] = now;
    updates['paused_at'] = null;
  } else if (target === 'paused') {
    updates['paused_at'] = now;
  } else if (target === 'closed') {
    updates['closed_at'] = now;
  } else if (target === 'draft') {
    // unpublish is intentionally restricted by the state machine above (draft←active is not allowed).
    // If reached, clear publish timestamps so RLS (can_view_program) hides it from anon.
    updates['published_at'] = null;
    updates['paused_at'] = null;
  }

  let { error } = await supabase.from('programs').update(updates).eq('id', programId);
  // Graceful fallback if lifecycle columns don't exist yet (older DB)
  if (error && /published_at|paused_at|closed_at/i.test(error.message)) {
    const fallback: Record<string, unknown> = { status: target };
    // keep published_at for active if possible
    if (target === 'active' && !/published_at/i.test(error.message)) fallback['published_at'] = now;
    let retry = await supabase.from('programs').update(fallback).eq('id', programId);
    if (retry.error && /published_at|paused_at|closed_at/i.test(retry.error.message)) {
      retry = await supabase.from('programs').update({ status: target }).eq('id', programId);
    }
    error = retry.error;
  }
  if (error) throw new Error(error.message);

  // audit log — use allowed enum 'update' (publish is a status update)
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.user.id,
      action: 'update',
      entity: 'programs',
      entity_id: programId,
      metadata: { action: target === 'active' ? 'publish' : target, from: current, to: target },
    });
  } catch {
    // audit failure should not block transition
  }

  if (target === 'active') {
    await notifyCompanyMembers(supabase, program.company_id, {
      title: `نُشر البرنامج — ${target}`,
      body: `انتقل البرنامج من ${current} إلى ${target}`,
      link: `/company/programs/${programId}`,
    });
  }

  revalidatePath('/programs');
  revalidatePath('/company/programs');
  revalidatePath(`/programs/${programId}`);
  revalidatePath(`/company/programs/${programId}`);
  revalidatePath('/');
}

/** Draft/paused → active: makes the program publicly visible. GATED. */
export async function publishProgramAction(programId: string) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('غير مصرح');
  const program = await requireOwnedProgram(supabase, user.user.id, programId);
  const current = program.status as string;
  assertTransition(current, 'active');
  const readiness = await checkPublishReadiness(supabase, programId);
  if (!readiness.ready) {
    throw new Error(`البرنامج غير جاهز للنشر:\n- ${readiness.missing.join('\n- ')}`);
  }
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: 'active', published_at: now, paused_at: null };
  let { error } = await supabase.from('programs').update(updates).eq('id', programId);
  if (error && /published_at|paused_at/i.test(error.message)) {
    const retry = await supabase.from('programs').update({ status: 'active', published_at: now }).eq('id', programId);
    if (retry.error && /published_at/i.test(retry.error.message)) {
      const r2 = await supabase.from('programs').update({ status: 'active' }).eq('id', programId);
      error = r2.error;
    } else {
      error = retry.error;
    }
  }
  if (error) throw new Error(error.message);

  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.user.id,
      action: 'update',
      entity: 'programs',
      entity_id: programId,
      metadata: { action: 'publish', from: current, to: 'active' },
    });
  } catch {
    /* ignore audit errors */
  }

  await notifyCompanyMembers(supabase, program.company_id, {
    title: `نُشر البرنامج وبات ظاهرًا للباحثين`,
    body: `البرنامج أصبح active — الرابط العام متاح الآن`,
    link: `/programs`,
  });

  revalidatePath('/programs');
  revalidatePath('/company/programs');
  revalidatePath(`/programs/${programId}`);
  revalidatePath(`/company/programs/${programId}`);
  revalidatePath('/');
}

/** Active → paused: hides from public listing, keeps data. Sets paused_at. */
export async function pauseProgramAction(programId: string) {
  await doTransition(programId, 'paused');
}

/** Paused → active: re-publish. GATED (readiness re-checked inside doTransition). */
export async function resumeProgramAction(programId: string) {
  await doTransition(programId, 'active');
}

/** Valid: draft/active/paused/pending_review -> closed. Sets closed_at. */
export async function closeProgramAction(programId: string) {
  await doTransition(programId, 'closed');
}

/**
 * Unpublish back to draft — NOT part of the strict state machine.
 * Allowed transitions do NOT include active→draft or paused→draft, so this
 * will throw with Arabic message. Kept for explicit RLS handling: when/if
 * admin enables draft←active, the program becomes invisible via can_view_program (anon sees only active+public).
 */
export async function unpublishProgramAction(programId: string) {
  await doTransition(programId, 'draft');
}

export async function updateProgramAction(programId: string, formData: FormData) {
  const raw = {
    name: formData.get('name'),
    description: formData.get('description'),
    scope: formData.get('scope'),
    contact_email: formData.get('contact_email'),
  };
  const parsed = programSchema
    .pick({ name: true, description: true })
    .extend({
      scope: programSchema.shape.scope,
      contact_email: programSchema.shape.contact_email,
    })
    .safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'بيانات البرنامج غير صالحة');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('غير مصرح');
  await requireOwnedProgram(supabase, user.user.id, programId);
  const { error } = await supabase.from('programs').update(parsed.data).eq('id', programId);
  if (error) throw new Error(error.message);
  revalidatePath('/programs');
  revalidatePath('/company/programs');
  revalidatePath(`/programs/${programId}`);
  revalidatePath(`/company/programs/${programId}`);
  revalidatePath('/');
}

export async function toggleSaveProgram(programId: string, saved: boolean) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('غير مصرح');
  // Researcher identity always comes from the session, never arguments
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) throw new Error('للباحثين فقط');
  if (saved) {
    await supabase.from('saved_programs').delete().eq('program_id', programId).eq('researcher_id', rp.id);
  } else {
    await supabase.from('saved_programs').insert({ program_id: programId, researcher_id: rp.id });
  }
  revalidatePath('/programs');
}
