'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { slugify } from '@/utils/slug';
import { checkPublishReadiness } from '@/features/programs/services';
import type { WizardData } from './types';

type ActionResult = { ok: true; programId: string } | { ok: false; error: string };

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
