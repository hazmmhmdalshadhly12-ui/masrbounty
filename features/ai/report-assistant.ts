'use server';

/**
 * AI Report Assistant — server-side actions.
 *
 * Core safety contract (enforced in every task prompt AND by the UI):
 *  - the AI NEVER invents test results, evidence, HTTP responses, PoCs or
 *    steps the researcher did not perform — it may only rephrase/structure
 *    what the researcher provided and point out what is missing;
 *  - severity/CWE/CVSS suggestions are ADVISORY; the researcher reviews and
 *    accepts them; nothing is ever auto-submitted (the UI only fills fields);
 *  - every request is quota-gated and usage-logged via lib/ai/service.ts.
 */

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { runAiFeature, getAiStatusForUser } from '@/lib/ai/service';

export const REPORT_ASSISTANT_TASKS = [
  'improve_title',
  'improve_summary',
  'improve_description',
  'organize_steps',
  'improve_impact',
  'improve_remediation',
  'suggest_severity_cwe',
  'review_gaps',
  'polish_language',
  'structure_notes',
  'summarize_for_company',
  'redact_sensitive',
] as const;
export type ReportAssistantTask = (typeof REPORT_ASSISTANT_TASKS)[number];

const NO_FABRICATION_AR = `
قواعد صارمة (غير قابلة للتفاوض):
- لا تخترع أبدًا نتائج اختبارات أو أدلة أو لقطات شاشة أو استجابات HTTP أو خطوات لم ينفذها الباحث.
- لا تختلق Proof of Concept أو أرقامًا أو روابط أو بيانات غير موجودة في المدخلات.
- استخدم فقط المعلومات التي قدمها الباحث؛ أعد صياغتها وتنظيمها ووضوحها فقط.
- إن كانت المعلومات ناقصة، أشر إلى الناقص في مكان "notes" بدل تعويضه من عندك.
- اقتراحاتك استرشادية وقابلة للمراجعة؛ لا تقدمها كقرارات نهائية.
- اكتب بنفس لغة النص المقدم (عربي أو إنجليزي) وبأسلوب تقرير أمني احترافي.`;

const TASK_PROMPTS: Record<ReportAssistantTask, string> = {
  improve_title: `أنت محرر تقارير أمنية. حسّن عنوان الثغرة ليكون دقيقًا ومهنيًا بصيغة: [نوع الثغرة] في [الموقع/المكوّن]. حافظ على الحقائق كما هي، ولا تضف ادعاءات جديدة. أعِد JSON: {"suggestion": "العنوان المحسّن", "notes": "سبب التحسين بإيجاز"}.`,
  improve_summary: `أنت محرر تقارير أمنية. حسّن ملخص الثغرة ليكون موجزًا (2-4 جمل) يوضح: ما الثغرة، أين، وما أثرها العام. لا تضف تفاصيل لم يذكرها الباحث. أعِد JSON: {"suggestion": "...", "notes": "..."}.`,
  improve_description: `أنت محرر تقارير أمنية. حسّن وصف الثغرة بتنظيم واضح: سياق المكوّن، طبيعة الخلل، لماذا يحدث. حافظ على كل الحقائق التقنية التي قدمها الباحث حرفيًا قدر الإمكان ولا تضف تفاصيل اختبار جديدة. أعِد JSON: {"suggestion": "...", "notes": "..."}.`,
  organize_steps: `أنت محرر تقارير أمنية. نظّم خطوات إعادة الإنتاج التي كتبها الباحث في قائمة مرقمة متسلسلة وواضحة (كل خطوة فعل واحد قابل للتنفيذ). لا تضف خطوات لم ينفذها الباحث ولا نتائج استجابات افتراضية. إن وجدت خطوة غامضة أشر إليها في notes. أعِد JSON: {"suggestion": "1. ...\n2. ...", "notes": "..."}.`,
  improve_impact: `أنت محرر تقارير أمنية. حسّن قسم الأثر ليصف بدقة ما يستطيع المهاجم تحقيقه فعليًا بناءً على ما ورد فقط، مع تمييز الأثر الواقعي عن الافتراضي. لا تبالغ ولا توسّع النطاق. أعِد JSON: {"suggestion": "...", "notes": "..."}.`,
  improve_remediation: `أنت مهندس أمن تطبيقات. اقترح إصلاحًا عمليًا موجزًا للثغرة الموصوفة (إرشادات عامة معتمدة مثل التحقق من المدخلات/الصلاحيات/الترميز حسب النوع). أشر بوضوح أنه مقترح استرشادي وليس توجيهًا نهائيًا. أعِد JSON: {"suggestion": "...", "notes": "..."}.`,
  suggest_severity_cwe: `أنت محلل ثغرات خبير بـ CVSS وCWE. بناءً على المعلومات المقدمة فقط: اقترح خطورة مبدئية من (informational|low|medium|high|critical) وكود CWE واحد الأنسب (مثل CWE-79). قيمة CVSS استرشادية فقط إن أمكن استنتاجها. أشر بوضوح أن الاقتراح استرشادي وأن القرار النهائي لفريق الفرز. أعِد JSON: {"severity": "...", "cwe": "CWE-...", "rationale": "...", "cvss_estimate": 0.0}.`,
  review_gaps: `أنت مراجع تقارير أمنية. راجع التقرير واذكر قائمة بالمعلومات الناقصة التي قد يطلبها فريق الفرز (مثل: إصدار النسخة المتأثرة، شروط الاستغلال، صلاحيات الحساب المستخدم في الاختبار). لا تعيد كتابة التقرير. أعِد JSON: {"suggestion": "قائمة مرقمة بالمعلومات الناقصة وسبب أهمية كل منها", "notes": ""}.`,
  polish_language: `أنت مدقق لغوي. حسّن الصياغة والقواعد والترقيم فقط دون تغيير المعنى أو إضافة أي معلومة جديدة. أعِد JSON: {"suggestion": "...", "notes": "أهم التغييرات اللغوية بإيجاز"}.`,
  structure_notes: `أنت محرر تقارير أمنية. حوّل الملاحظات غير المنظمة التي كتبها الباحث إلى وصف تقرير واضح منظّم. اسمح بنقل الملاحظات فقط — لا تضف اختبارات أو نتائج لم تُذكر. ما لا يمكن فهمه ضعه في notes كسؤال للباحث. أعِد JSON: {"suggestion": "...", "notes": "أسئلة توضيحية إن وجدت"}.`,
  summarize_for_company: `أنت كاتب تنفيذي. لخّص التقرير في 3-5 جمل موجّهة لفريق الشركة الأمني: الثغرة، مكانها، أثرها، والإصلاح المطلوب باختصار. اعتمد فقط على ما ورد. أعِد JSON: {"suggestion": "...", "notes": ""}.`,
  redact_sensitive: `أنت مسؤول أمن معلومات. راجع النص واقترح نسخة تُخفي أو تعمّم المعلومات الحساسة غير الضرورية للإبلاغ (مثل بيانات اعتماد حقيقية، أرقام حسابات، أسماء مستخدمين فعليين، أسرار عمل) مع الإبقاء على القيمة التقنية للتقرير. اشرح في notes ما تم تغييره. أعِد JSON: {"suggestion": "...", "notes": "..."}.`,
};

const contextSchema = z.object({
  title: z.string().max(300).optional().default(''),
  summary: z.string().max(6000).optional().default(''),
  vulnerability_type: z.string().max(120).optional().default(''),
  severity: z.string().max(20).optional().default(''),
  affected_asset: z.string().max(600).optional().default(''),
  description: z.string().max(12000).optional().default(''),
  impact: z.string().max(6000).optional().default(''),
  reproduction_steps: z.string().max(8000).optional().default(''),
  remediation: z.string().max(6000).optional().default(''),
  cvss_score: z.string().max(8).optional().default(''),
  program_name: z.string().max(200).optional().default(''),
  target_field: z.string().max(60).optional().default(''),
  draft_notes: z.string().max(12000).optional().default(''),
  language: z.enum(['ar', 'en']).optional().default('ar'),
});

export type ReportAssistantContext = z.input<typeof contextSchema>;

export type AssistantActionResult =
  | {
      ok: true;
      task: ReportAssistantTask;
      suggestion: string;
      notes: string;
      severity?: string;
      cwe?: string;
      cvssEstimate?: number;
      remainingToday: number;
    }
  | { ok: false; error: string; setupHint?: boolean };

function buildUserPrompt(task: ReportAssistantTask, ctx: z.infer<typeof contextSchema>): string {
  const lines: string[] = [];
  if (ctx.program_name) lines.push(`البرنامج: ${ctx.program_name}`);
  if (ctx.title) lines.push(`العنوان الحالي: ${ctx.title}`);
  if (ctx.vulnerability_type) lines.push(`النوع: ${ctx.vulnerability_type}`);
  if (ctx.severity) lines.push(`الخطورة الحالية: ${ctx.severity}`);
  if (ctx.cvss_score) lines.push(`CVSS الحالي: ${ctx.cvss_score}`);
  if (ctx.affected_asset) lines.push(`الأصل المتأثر: ${ctx.affected_asset}`);
  if (ctx.summary) lines.push(`الملخص الحالي:\n${ctx.summary}`);
  if (ctx.description) lines.push(`الوصف الحالي:\n${ctx.description}`);
  if (ctx.impact) lines.push(`الأثر الحالي:\n${ctx.impact}`);
  if (ctx.reproduction_steps) lines.push(`خطوات الاستنساخ الحالية:\n${ctx.reproduction_steps}`);
  if (ctx.remediation) lines.push(`الإصلاح الحالي:\n${ctx.remediation}`);
  if (ctx.draft_notes) lines.push(`ملاحظات الباحث الخام:\n${ctx.draft_notes}`);
  if (ctx.target_field) lines.push(`المطلوب تحسين الحقل: ${ctx.target_field}`);
  lines.push(
    `المهمة المطلوبة: ${task}. ${ctx.language === 'en' ? 'أجب بالإنجليزية.' : 'أجب بالعربية الواضحة.'}`
  );
  return lines.join('\n\n').slice(0, 20_000);
}

/** Status for the UI (button visibility, remaining quota). */
export async function getReportAssistantStatusAction(): Promise<{
  available: boolean;
  remainingToday: number;
  limitToday: number;
  message?: string;
  setupHint?: boolean;
}> {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      return { available: false, remainingToday: 0, limitToday: 0, message: 'سجّل الدخول لاستخدام المساعد' };
    }
    const st = await getAiStatusForUser(uid, 'report_assistant');
    if (!st.configured) {
      return {
        available: false,
        remainingToday: 0,
        limitToday: st.limitToday,
        message: 'ميزة الذكاء الاصطناعي غير مُعدة على المنصة بعد.',
        setupHint: true,
      };
    }
    if (!st.enabled || !st.featureAllowed) {
      return {
        available: false,
        remainingToday: 0,
        limitToday: st.limitToday,
        message: 'مساعد الذكاء الاصطناعي معطّل حاليًا من الإدارة.',
      };
    }
    return {
      available: true,
      remainingToday: st.remainingToday,
      limitToday: st.limitToday,
      message: st.remainingToday <= 3 ? `تبقّى ${st.remainingToday} طلبات اليوم فقط` : undefined,
    };
  } catch {
    return { available: false, remainingToday: 0, limitToday: 0, message: 'تعذر التحقق من حالة المساعد' };
  }
}

/** Run one assistant task. Suggestion only — the client applies it on approval. */
export async function aiReportAssistAction(
  task: ReportAssistantTask,
  context: ReportAssistantContext
): Promise<AssistantActionResult> {
  try {
    if (!REPORT_ASSISTANT_TASKS.includes(task)) {
      return { ok: false, error: 'مهمة غير معروفة' };
    }
    const parsed = contextSchema.safeParse(context ?? {});
    if (!parsed.success) return { ok: false, error: 'بيانات غير صالحة للمساعد' };
    const ctx = parsed.data;

    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: 'انتهت الجلسة — سجّل الدخول ثم أعد المحاولة' };

    // Basic sanity: the task must have something to work with.
    const hasMaterial =
      ctx.title || ctx.summary || ctx.description || ctx.impact || ctx.reproduction_steps || ctx.draft_notes;
    if (!hasMaterial) {
      return { ok: false, error: 'اكتب بعض المعلومات أولًا ليستطيع المساعد مساعدتك' };
    }

    const res = await runAiFeature({
      userId: uid,
      feature: 'report_assistant',
      systemPrompt: NO_FABRICATION_AR + '\n' + TASK_PROMPTS[task],
      userPrompt: buildUserPrompt(task, ctx),
      maxTokens: 1400,
      temperature: 0.3,
      jsonMode: true,
    });

    if (!res.ok) {
      return { ok: false, error: res.message, setupHint: res.code === 'not_configured' };
    }

    // Parse the structured reply (defensive: providers vary).
    let suggestion = '';
    let notes = '';
    let severity: string | undefined;
    let cwe: string | undefined;
    let cvssEstimate: number | undefined;
    try {
      const cleaned = res.content
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();
      const obj = JSON.parse(cleaned) as Record<string, unknown>;
      suggestion = typeof obj['suggestion'] === 'string' ? obj['suggestion'] : '';
      notes = typeof obj['notes'] === 'string' ? obj['notes'] : '';
      if (typeof obj['severity'] === 'string') severity = obj['severity'];
      if (typeof obj['cwe'] === 'string') cwe = obj['cwe'];
      if (typeof obj['rationale'] === 'string' && !notes) notes = obj['rationale'];
      if (typeof obj['cvss_estimate'] === 'number') cvssEstimate = obj['cvss_estimate'];
      if (!suggestion && typeof obj['rationale'] === 'string') suggestion = obj['rationale'];
    } catch {
      // Non-JSON reply → treat the whole content as the suggestion.
      suggestion = res.content;
    }
    if (!suggestion.trim()) {
      return { ok: false, error: 'جاء رد فارغ من الخدمة — أعد المحاولة' };
    }
    if (severity && !['informational', 'low', 'medium', 'high', 'critical'].includes(severity)) {
      severity = undefined;
    }
    if (cwe && !/^CWE-\d{1,4}$/i.test(cwe.trim())) cwe = undefined;

    return {
      ok: true,
      task,
      suggestion: suggestion.trim(),
      notes: notes.trim(),
      severity,
      cwe: cwe?.toUpperCase(),
      cvssEstimate,
      remainingToday: res.remainingToday,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع في المساعد' };
  }
}
