'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { slugify } from '@/utils/slug';
import { checkPublishReadiness } from '@/features/programs/services';
import type { WizardData } from './types';
import { randomHex, sha256Hex, isValidVerificationToken } from '@/lib/security/edge-crypto';
import { checkVerificationTxt } from '@/lib/security/dns-txt';
import { sanitizeWizardDraft, draftFitsBudget, DRAFT_MAX_JSON_CHARS } from './draft-sanitize';

type ActionResult = { ok: true; programId: string } | { ok: false; error: string };

/** Resolve the caller's company id (owner or member) or null. */
async function resolveCompanyId(supabase: Awaited<ReturnType<typeof createServerClient>>, uid: string): Promise<string | null> {
  const { data: owned } = await supabase.from('company_profiles').select('id').eq('owner_id', uid).maybeSingle();
  if (owned) return (owned as { id: string }).id;
  const { data: mem } = await supabase.from('company_members').select('company_id').eq('user_id', uid).limit(1).maybeSingle();
  return (mem as { company_id: string } | null)?.company_id ?? null;
}

/**
 * Persist a successful domain verification into company_domains (status=verified).
 * Real schema (masrbounty.sql §16.1): verification_token_plain / verification_token_hash — there is NO `token` column.
 * checkPublishReadiness reads this row, so errors must be surfaced, never swallowed.
 */
async function persistVerifiedDomain(d: string, token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: 'انتهت الجلسة — سجّل الدخول ثم أعد التحقق' };
    const companyId = await resolveCompanyId(supabase, uid);
    if (!companyId) return { ok: false, error: 'لم يتم العثور على شركة مرتبطة بحسابك — أكمل إنشاء ملف الشركة أولاً' };
    const hash = await sha256Hex(token);
    const { error: upErr } = await supabase.from('company_domains').upsert({
      company_id: companyId,
      domain: d,
      verification_token_plain: token,
      verification_token_hash: hash,
      status: 'verified',
      verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
    }, { onConflict: 'company_id,domain' });
    // Do NOT swallow persistence errors: a silent failure would deadlock the
    // wizard (verified in UI, missing in DB → publish gate refuses forever).
    if (upErr) return { ok: false, error: 'تم التحقق بنجاح لكن فشل حفظ التوثيق: ' + upErr.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'فشل حفظ التوثيق: ' + (e instanceof Error ? e.message : 'خطأ غير متوقع') };
  }
}

export async function createWizardProgramAction(payload: WizardData): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: 'غير مصرح — سجّل الدخول أولاً' };

    // company
    const userId = auth.user.id;
    let companyId: string | null = null;
    const { data: owned } = await supabase.from('company_profiles').select('id').eq('owner_id', userId).maybeSingle();
    if (owned) companyId = (owned as { id: string }).id;
    else {
      const { data: mem } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (mem) companyId = (mem as { company_id: string }).company_id;
    }
    if (!companyId) return { ok: false, error: 'أنشئ ملف الشركة أولاً' };

    const b = payload.basic;
    const name = b.name.trim();
    if (name.length < 3) return { ok: false, error: 'اسم البرنامج قصير جدًا' };
    const slug = b.slug?.trim() ? slugify(b.slug.trim()) : slugify(name);
    const description = b.description.trim();
    if (description.length < 50) return { ok: false, error: 'الوصف يجب أن يكون ٥٠ حرفًا على الأقل' };
    const contact_email = b.contact_email.trim();

    // scope concatenation for programs.scope (required field)
    const scopeText = payload.scope.assets.map((a) => `${a.type}:${a.value.trim()}`).join(', ');
    if (!scopeText) return { ok: false, error: 'النطاق مطلوب' };

    const { data: program, error: progErr } = await supabase
      .from('programs')
      .insert({
        company_id: companyId,
        name,
        slug,
        description,
        logo_url: b.logo_url?.trim() || null,
        visibility: payload.disclosure.visibility,
        status: 'draft',
        scope: scopeText,
        out_of_scope: payload.scope.out_of_scope?.trim() || null,
        safe_harbor: payload.rules.safeHarbor?.trim() || null,
        contact_email,
        response_sla_hours: payload.sla.response_hours,
        created_by: userId,
      })
      .select('id')
      .single();

    if (progErr || !program) {
      const msg = progErr?.message ?? 'فشل إنشاء البرنامج';
      if (/duplicate|unique|slug/i.test(msg)) return { ok: false, error: 'المعرّف (slug) مستخدم بالفعل — جرّب اسمًا آخر' };
      return { ok: false, error: msg };
    }
    const programId = (program as { id: string }).id;

    // assets
    const assetsToInsert = payload.scope.assets
      .filter((a) => a.value.trim().length >= 2)
      .map((a) => ({
        program_id: programId,
        type: a.type,
        value: a.value.trim(),
        description: a.description?.trim() || null,
      }));
    if (assetsToInsert.length > 0) {
      const { error: aErr } = await supabase.from('program_assets').insert(assetsToInsert);
      if (aErr) return { ok: false, error: `فشل حفظ الأصول: ${aErr.message}` };
    }

    // rules — map wizard rules to program_rules rows
    const rulesToInsert: { program_id: string; title: string; content: string; sort_order: number }[] = [];
    const r = payload.rules;
    if (r.testingRules.trim()) rulesToInsert.push({ program_id: programId, title: 'قواعد الاختبار', content: r.testingRules.trim(), sort_order: 1 });
    if (r.safeHarbor.trim()) rulesToInsert.push({ program_id: programId, title: 'الملاذ الآمن', content: r.safeHarbor.trim(), sort_order: 2 });
    if (r.prohibited.trim()) rulesToInsert.push({ program_id: programId, title: 'المحظورات', content: r.prohibited.trim(), sort_order: 3 });
    if (r.rateLimits.trim()) rulesToInsert.push({ program_id: programId, title: 'حدود المعدل', content: r.rateLimits.trim(), sort_order: 4 });
    if (r.disclosurePolicy.trim()) rulesToInsert.push({ program_id: programId, title: 'سياسة الإفصاح', content: r.disclosurePolicy.trim(), sort_order: 5 });
    // SLA as rules
    rulesToInsert.push({
      program_id: programId,
      title: 'اتفاقية مستوى الخدمة',
      content: `الاستجابة: ${payload.sla.response_hours} ساعة — الفرز: ${payload.sla.triage_hours} ساعة — المعالجة: ${payload.sla.resolution_hours} ساعة — الإفصاح: ${payload.disclosure.disclosureMode}`,
      sort_order: 10,
    });
    if (rulesToInsert.length > 0) {
      const { error: rErr } = await supabase.from('program_rules').insert(rulesToInsert);
      if (rErr) return { ok: false, error: `فشل حفظ القواعد: ${rErr.message}` };
    }

    // bounty policies
    const policiesToInsert = payload.rewards.policies.map((p) => ({
      program_id: programId,
      severity: p.severity,
      min_amount: p.min_amount,
      max_amount: p.max_amount,
    }));
    if (policiesToInsert.length > 0) {
      const { error: bErr } = await supabase.from('bounty_policies').insert(policiesToInsert);
      if (bErr) return { ok: false, error: `فشل حفظ سياسات المكافآت: ${bErr.message}` };
    }

    revalidatePath('/company/programs');
    return { ok: true, programId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع';
    return { ok: false, error: msg };
  }
}

export type CreateTokenResult =
  | { ok: true; token: string; sentence: string }
  | { ok: false; error: string };

/**
 * Create (or reuse) the verification token for company+domain. Returns a
 * SPECIFIC Arabic error for every failure mode so the UI never has to show a
 * generic "تعذّر توليد الرمز" hint.
 */
export async function createVerificationTokenAction(domain: string): Promise<CreateTokenResult> {
  const d = domain.trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) {
    return { ok: false, error: 'صيغة الدومين غير صحيحة — اكتبها بدون https أو مسارات (مثال: example.com)' };
  }
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: 'انتهت الجلسة — سجّل الدخول ثم أعد المحاولة' };
    const companyId = await resolveCompanyId(supabase, uid);
    if (!companyId) {
      return { ok: false, error: 'لا يوجد ملف شركة مرتبط بحسابك — أكمل إنشاء ملف الشركة أولاً ثم أعد المحاولة' };
    }
    // Reuse the stored token for this company+domain so the file the company
    // already deployed keeps working after a page refresh / new wizard session.
    const { data: existing } = await supabase
      .from('company_domains')
      .select('verification_token_plain, status')
      .eq('company_id', companyId)
      .eq('domain', d)
      .maybeSingle();
    const existingToken = (existing as { verification_token_plain: string | null; status: string } | null)?.verification_token_plain ?? null;
    const existingStatus = (existing as { status: string } | null)?.status ?? '';
    if (existingToken && existingStatus !== 'expired' && isValidVerificationToken(existingToken)) {
      return { ok: true, token: existingToken, sentence: `masrbounty-verification=${existingToken}` };
    }
    // No usable token yet — create a pending row so the token survives reloads.
    const token = randomHex(16);
    const hash = await sha256Hex(token);
    const { error } = await supabase.from('company_domains').upsert({
      company_id: companyId,
      domain: d,
      verification_token_plain: token,
      verification_token_hash: hash,
      status: 'pending',
      verified_at: null,
      expires_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
    }, { onConflict: 'company_id,domain' });
    if (error) return { ok: false, error: 'تعذر حفظ رمز التحقق: ' + error.message };
    return { ok: true, token, sentence: `masrbounty-verification=${token}` };
  } catch (e) {
    return { ok: false, error: 'تعذر إنشاء رمز التحقق: ' + (e instanceof Error ? e.message : 'خطأ غير متوقع') };
  }
}

export type FileVerifyResult = { verified: boolean; error?: string };

/**
 * File-based verification with precise diagnostics: the error message tells the
 * company exactly WHICH path failed and WHY (404 / wrong content / unreachable).
 */
export async function verifyDomainFileAction(domain: string, token: string): Promise<FileVerifyResult> {
  const d = domain.trim().toLowerCase();
  if (!d || !token) return { verified: false, error: 'الدومين والرمز مطلوبان' };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return { verified: false, error: 'الدومين غير صالح' };
  // Only accept server-format tokens and the exact sentence — a bare substring match
  // let SPA catch-all pages (HTTP 200 for any path) "verify" with a trivial token.
  if (!isValidVerificationToken(token)) return { verified: false, error: 'رمز التحقق غير صالح — أنشئ رمزًا جديدًا' };
  const sentence = `masrbounty-verification=${token}`;
  // Primary: token-as-filename at the root (hazem.blog/<token>.txt);
  // legacy paths still accepted for domains that already deployed them.
  const urls = [
    { url: `https://${d}/${token}.txt`, primary: true },
    { url: `https://${d}/.well-known/masrbounty-verification.txt`, primary: false },
    { url: `https://${d}/masrbounty-verification.txt`, primary: false },
  ];
  let sawContentMismatch = false;
  let saw404 = false;
  let sawOtherHttp: number | null = null;
  let netFailures = 0;
  for (const { url } of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        if (res.status === 404) saw404 = true;
        else sawOtherHttp = res.status;
        continue;
      }
      const text = await res.text();
      if (text.split(/\r?\n/).some((line) => line.trim() === sentence)) {
        const saved = await persistVerifiedDomain(d, token);
        return saved.ok ? { verified: true } : { verified: false, error: saved.error };
      }
      sawContentMismatch = true;
    } catch {
      netFailures += 1;
    }
  }
  const primaryUrl = `https://${d}/${token}.txt`;
  if (netFailures === urls.length) {
    return {
      verified: false,
      error:
        'تعذر الوصول إلى موقعك عبر HTTPS — تأكد أن الموقع يعمل وأنه يدعم HTTPS (بدون شهادة SSL الموقع لا يمكن فحصه)، ثم أعد الفحص',
    };
  }
  if (sawContentMismatch) {
    return {
      verified: false,
      error:
        'وصلنا إلى الملف لكن المحتوى غير مطابق — يجب أن يحتوي الملف على هذا السطر بالضبط (بدون HTML أو نص إضافي):\n' +
        sentence,
    };
  }
  if (saw404) {
    return {
      verified: false,
      error:
        'الملف غير موجود (HTTP 404) على ' + primaryUrl +
        ' — ارفع الملف في جذر الموقع بنفس الاسم والمسار بالضبط، أو استخدم المسار البديل /.well-known/masrbounty-verification.txt',
    };
  }
  if (sawOtherHttp) {
    return {
      verified: false,
      error: `الخادم ردّ برمز HTTP ${sawOtherHttp} عند فحص ${primaryUrl} — تأكد أن الملف متاح للعامة بدون حماية بكلمة مرور`,
    };
  }
  return {
    verified: false,
    error: 'لم يتم العثور على الملف — أنشئ الملف على ' + primaryUrl + ' (المسار البديل: /.well-known/masrbounty-verification.txt) ثم أعد الفحص',
  };
}

/**
 * DNS TXT verification (primary method): the company adds a TXT record on
 * `_masrbounty.<domain>` (or the apex) containing `masrbounty-verification=<token>`.
 * Resolution uses DNS-over-HTTPS (RFC 8484) via lib/security/dns-txt, with a
 * precise failure diagnosis (NXDOMAIN / no records / wrong value / resolver down).
 */
export async function verifyDomainTxtAction(domain: string, token: string): Promise<{ verified: boolean; error?: string; host?: string }> {
  const d = domain.trim().toLowerCase();
  if (!d || !token) return { verified: false, error: 'الدومين والرمز مطلوبان' };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return { verified: false, error: 'الدومين غير صالح' };
  if (!isValidVerificationToken(token)) return { verified: false, error: 'رمز التحقق غير صالح — أنشئ رمزًا جديدًا' };
  const res = await checkVerificationTxt(d, token);
  if (!res.found) {
    const host = `_masrbounty.${d}`;
    const value = `masrbounty-verification=${token}`;
    let reason: string;
    switch (res.status) {
      case 'nxdomain':
        reason = `الدومين ${d} غير موجود في DNS (NXDOMAIN) — تأكد من كتابة الدومين بشكل صحيح ومن أن الموقع يعمل`;
        break;
      case 'no_records':
        reason = `لم يتم العثور على أي سجل TXT على المضيف ${host} — أضف السجل أولًا (Type: TXT) ثم أعد الفحص`;
        break;
      case 'wrong_value':
        reason = `يوجد ${res.txtCount ?? 'بعض'} سجل TXT على المضيف ${host} لكن قيمته غير مطابقة — تأكد أن القيمة هي بالضبط: ${value}`;
        break;
      case 'resolver_error':
        reason = 'تعذر الوصول إلى خدمات DNS (Cloudflare وGoogle معًا) — غالبًا خلل مؤقت، أعد الفحص بعد لحظات';
        break;
      default:
        reason = `لم يتم العثور على سجل TXT بالرمز — أضف سجلًا على المضيف ${host} بالقيمة ${value}`;
    }
    return {
      verified: false,
      error:
        reason +
        ' (قد يستغرق انتشار DNS من دقائق إلى 48 ساعة) — جرّب زر «إعادة الفحص» بعد إضافة السجل',
    };
  }
  const saved = await persistVerifiedDomain(d, token);
  return saved.ok ? { verified: true, host: res.host } : { verified: false, error: saved.error };
}

export async function checkWizardReadinessAction(programId: string): Promise<{ ready: boolean; missing: string[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const res = await checkPublishReadiness(supabase as never, programId);
    return res;
  } catch (e) {
    return { ready: false, missing: [], error: e instanceof Error ? e.message : 'فشل التحقق' };
  }
}

export async function publishWizardProgramAction(programId: string): Promise<ActionResult> {
  try {
    const { publishProgramAction } = await import('@/features/programs/services');
    await publishProgramAction(programId);
    return { ok: true, programId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'فشل النشر' };
  }
}

/* ── Wizard draft persistence (backend autosave — resume anytime) ─────────
 * One active draft per company in program_drafts (masrbounty.sql §16.1b).
 * RLS: owner/member/admin only. The payload is sanitized server-side before
 * it touches the database; nothing is trusted from the client. */

export type SaveDraftResult = { ok: true; savedAt: string } | { ok: false; error: string };
export type LoadDraftResult =
  | { ok: true; draft: { data: WizardData; step: number; updatedAt: string } | null }
  | { ok: false; error: string };

/** Autosave the whole wizard state (debounced client-side). */
export async function saveWizardDraftAction(data: WizardData, step: number): Promise<SaveDraftResult> {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: 'انتهت الجلسة — سجّل الدخول لحفظ المسودة' };
    const companyId = await resolveCompanyId(supabase, uid);
    if (!companyId) return { ok: false, error: 'أنشئ ملف الشركة أولاً لحفظ المسودة' };

    const clean = sanitizeWizardDraft(data);
    if (!clean) return { ok: false, error: 'بيانات المسودة غير صالحة' };
    if (!draftFitsBudget(clean)) {
      return { ok: false, error: `حجم المسودة يتجاوز الحد (${Math.round(DRAFT_MAX_JSON_CHARS / 1000)}KB) — اختصر النصوص الطويلة` };
    }
    const safeStep = Number.isInteger(step) ? Math.max(1, Math.min(9, step)) : 1;

    const { error } = await supabase
      .from('program_drafts')
      .upsert({ company_id: companyId, data: clean, step: safeStep }, { onConflict: 'company_id' });
    if (error) return { ok: false, error: 'فشل حفظ المسودة: ' + error.message };
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: 'فشل حفظ المسودة: ' + (e instanceof Error ? e.message : 'خطأ غير متوقع') };
  }
}

/** Load the company's active draft (null when there is none). */
export async function loadWizardDraftAction(): Promise<LoadDraftResult> {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: true, draft: null };
    const companyId = await resolveCompanyId(supabase, uid);
    if (!companyId) return { ok: true, draft: null };
    const { data: row, error } = await supabase
      .from('program_drafts')
      .select('data, step, updated_at')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) return { ok: false, error: 'فشل قراءة المسودة: ' + error.message };
    if (!row) return { ok: true, draft: null };
    const clean = sanitizeWizardDraft((row as { data: unknown }).data);
    if (!clean) {
      // Corrupt/legacy shape — drop it instead of hydrating broken state.
      await supabase.from('program_drafts').delete().eq('company_id', companyId);
      return { ok: true, draft: null };
    }
    const step = Number((row as { step: number }).step) || 1;
    return {
      ok: true,
      draft: { data: clean, step: Math.max(1, Math.min(9, step)), updatedAt: String((row as { updated_at: string }).updated_at ?? '') },
    };
  } catch (e) {
    return { ok: false, error: 'فشل قراءة المسودة: ' + (e instanceof Error ? e.message : 'خطأ غير متوقع') };
  }
}

/** Delete the active draft (called after the program is created/published). */
export async function clearWizardDraftAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: 'انتهت الجلسة' };
    const companyId = await resolveCompanyId(supabase, uid);
    if (!companyId) return { ok: true };
    const { error } = await supabase.from('program_drafts').delete().eq('company_id', companyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/**
 * Verified domains for the signed-in company — StepVerification hydrates from
 * this so an already-verified domain shows "موثّق" immediately, with no
 * re-verification, even on a fresh wizard session.
 */
export async function getVerifiedDomainsAction(): Promise<{
  ok: boolean;
  domains?: { domain: string; status: string; token: string | null; expiresAt: string | null }[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: 'انتهت الجلسة' };
    const companyId = await resolveCompanyId(supabase, uid);
    if (!companyId) return { ok: true, domains: [] };
    const { data, error } = await supabase
      .from('company_domains')
      .select('domain, status, verification_token_plain, expires_at')
      .eq('company_id', companyId)
      .order('verified_at', { ascending: false, nullsFirst: false })
      .limit(20);
    if (error) return { ok: false, error: 'فشل قراءة الدومينات: ' + error.message };
    const domains = (data as { domain: string; status: string; verification_token_plain: string | null; expires_at: string | null }[] | null)?.map((r) => ({
      domain: r.domain,
      status: r.status,
      token: r.verification_token_plain,
      expiresAt: r.expires_at,
    })) ?? [];
    return { ok: true, domains };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}
