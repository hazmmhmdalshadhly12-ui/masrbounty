'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Check, Loader2, Plus, SearchCheck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  registerSchema,
  registerAccountStep,
  registerResearcherStep,
  registerCompanyStep,
  COMPANY_SIZES,
} from '@/schemas/auth';
import { friendlyAuthError } from '@/lib/auth/errors';
import { ensureUserBootstrap } from '@/lib/auth/bootstrap';
import { safeNext } from '@/lib/auth/redirect';
import { resetBrowserSession } from '@/lib/auth/browser-session';
import { MAX_SKILLS, parseSkills } from '@/lib/auth/onboarding';
import { registerAgreementStep } from '@/features/legal/schemas';
import { acceptLegalAgreementAction } from '@/features/legal/acceptance-actions';
import { REGISTRATION_CHECKS } from '@/constants/legal';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PasswordField } from '@/components/forms/password-field';

type Role = 'researcher' | 'company';
type FieldErrors = Record<string, string>;

const ROLE_OPTIONS: Array<{ value: Role; title: string; desc: string; icon: typeof SearchCheck }> = [
  { value: 'researcher', title: 'باحث أمني', desc: 'اكتشف الثغرات، أرسل تقاريرك، واكسب المكافآت', icon: SearchCheck },
  { value: 'company', title: 'شركة', desc: 'انشر برنامج مكافآت واستقبل تقارير باحثي الأمان', icon: Building2 },
];

const EXPERIENCE_OPTIONS: Array<{ value: 'beginner' | 'intermediate' | 'advanced' | 'expert'; label: string; hint: string }> = [
  { value: 'beginner', label: 'مبتدئ', hint: 'بداية رحلتي في الأمان' },
  { value: 'intermediate', label: 'متوسط', hint: 'خبرة عملية بسيطة' },
  { value: 'advanced', label: 'متقدم', hint: 'تقارير وتجارب موثقة' },
  { value: 'expert', label: 'خبير', hint: 'سنوات في الصيد الاحترافي' },
];

const SKILL_SUGGESTIONS = ['XSS', 'SQL Injection', 'IDOR', 'SSRF', 'Burp Suite', 'Recon', 'API Security', 'Mobile'];

/** Errors whose first occurrence lives on a given step (used to block advancing). */
function flattenErrors(err: { issues: Array<{ path: Array<PropertyKey>; message: string }> }): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

const STEP_NAMES = ['بيانات الحساب', 'تخصيص ملفك', 'الاتفاقية القانونية'];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6" aria-live="polite">
      <div className="flex items-center justify-between">
        {[1, 2, 3].slice(0, total).map((n) => (
          <div key={n} className="flex items-center gap-2">
            <span
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black transition-colors duration-150',
                n < current ? 'border-emerald-600 bg-emerald-600 text-white' : '',
                n === current ? 'border-primary bg-primary text-primary-foreground' : '',
                n > current ? 'border-muted bg-muted text-muted-foreground' : '',
              ].join(' ')}
              aria-current={n === current ? 'step' : undefined}
            >
              {n < current ? <Check className="h-4 w-4" /> : n}
            </span>
            <span className={['hidden text-xs font-bold sm:block', n === current ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
              {STEP_NAMES[n - 1]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${(current / total) * 100}%` }} />
      </div>
      <p className="mt-2 text-center text-xs font-medium text-muted-foreground">الخطوة {current} من {total}</p>
    </div>
  );
}

export function RegisterForm({ next = '' }: { next?: string }) {
  const router = useRouter();
  const target = safeNext(next || null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Legal & Security Agreement (step 3) — all five checks are mandatory
  const [agreement, setAgreement] = useState<Record<string, boolean>>({});
  const agreementValid = REGISTRATION_CHECKS.every((c) => agreement[c.id] === true);

  // account fields
  const [role, setRole] = useState<Role>('researcher');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // onboarding answers
  const [experienceLevel, setExperienceLevel] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [github, setGithub] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const skillsFull = skills.length >= MAX_SKILLS;

  const formValues = useMemo(
    () => ({
      username: username.trim(),
      email: email.trim(),
      password,
      confirmPassword,
      full_name: fullName.trim(),
      phone: phone.trim(),
      role,
      experience_level: experienceLevel,
      skills: skills.join(','),
      github: github.trim(),
      company_name: companyName.trim(),
      company_website: companyWebsite.trim(),
      company_size: companySize,
      company_description: companyDescription.trim(),
    }),
    [username, email, password, confirmPassword, fullName, phone, role, experienceLevel, skills, github, companyName, companyWebsite, companySize, companyDescription]
  );

  function applyErrors(fe: FieldErrors) {
    setFieldErrors(fe);
    setError(Object.keys(fe).length ? 'بيانات غير صالحة — راجع الحقول المحددة' : null);
  }

  function addSkill(raw: string) {
    const next = parseSkills(skills.join(',') + ',' + raw);
    setSkills(next);
    setSkillInput('');
  }

  function goToStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = registerAccountStep.safeParse(formValues);
    if (!parsed.success) {
      applyErrors(flattenErrors(parsed.error));
      return;
    }
    setStep(2);
  }

  function backToStep1() {
    setError(null);
    setFieldErrors({});
    setStep(1);
  }

  function goToStep3(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const step2 = role === 'researcher' ? registerResearcherStep : registerCompanyStep;
    const parsed = step2.safeParse(formValues);
    if (!parsed.success) {
      applyErrors(flattenErrors(parsed.error));
      return;
    }
    setStep(3);
  }

  function backToStep2() {
    setError(null);
    setFieldErrors({});
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    // Stage 3 gate: the Legal & Security Agreement is mandatory and cannot
    // be bypassed — the submit button is disabled until every box is ticked.
    const agreementParsed = registerAgreementStep.safeParse({
      terms: agreement.terms === true,
      age: agreement.age === true,
      privacy: agreement.privacy === true,
      authorized: agreement.authorized === true,
      scope: agreement.scope === true,
      context: 'registration' as const,
    });
    if (!agreementParsed.success) {
      setError('يجب الموافقة على جميع البنود الخمسة قبل إكمال التسجيل');
      setStep(3);
      return;
    }
    const parsed = registerSchema.safeParse(formValues);
    if (!parsed.success) {
      applyErrors(flattenErrors(parsed.error));
      const fe = flattenErrors(parsed.error);
      // send the user back to the step that owns the failing fields
      const accountKeys = ['username', 'email', 'password', 'confirmPassword', 'full_name', 'phone', 'role'];
      if (accountKeys.some((k) => k in fe)) setStep(1);
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      // Clean slate: stale cookies from older accounts shadow new sessions
      await resetBrowserSession(supabase);
      const { data, error: err } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: {
            username: parsed.data.username,
            role: parsed.data.role,
            full_name: parsed.data.full_name,
            phone: parsed.data.phone,
            // wizard answers ride along in user_metadata so the email-
            // confirmation path can apply them at first login bootstrap
            experience_level: parsed.data.experience_level ?? '',
            skills: parsed.data.skills ?? '',
            github: parsed.data.github ?? '',
            company_name: parsed.data.company_name ?? '',
            company_website: parsed.data.company_website ?? '',
            company_size: parsed.data.company_size ?? '',
            company_description: parsed.data.company_description ?? '',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      if (!data.user) {
        setError('فشل إنشاء الحساب — حاول مرة أخرى');
        return;
      }
      // No session yet => email confirmation required. Rows will be
      // bootstrapped automatically on first login.
      if (!data.session) {
        setPendingEmail(parsed.data.email);
        return;
      }
      const persisted = document.cookie
        .split(';')
        .map((c) => c.trim())
        .some((c) => c.startsWith('sb-') && c.includes('-auth-token') && !c.includes('code-verifier'));
      if (!persisted) {
        setError('المتصفح رفض حفظ الجلسة — تأكد من https وعطّل مانع الإعلانات ثم سجّل الدخول');
        return;
      }
      // Persist the acceptance record (user id, document versions, age
      // confirmation, timestamp) — server-side validated + immutable.
      try {
        const fd = new FormData();
        for (const c of REGISTRATION_CHECKS) fd.set(c.id, agreement[c.id] ? 'on' : 'off');
        fd.set('context', 'registration');
        await acceptLegalAgreementAction(fd);
      } catch {
        // Non-fatal: the login gate re-checks outstanding agreements.
      }
      await ensureUserBootstrap(supabase, data.user.id, {
        username: parsed.data.username,
        role: parsed.data.role,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        experience_level: parsed.data.experience_level,
        skills: parsed.data.skills,
        github: parsed.data.github,
      });
      // Companies land on the company wizard with their answers prefilled;
      // an explicit ?next= still wins.
      if (!next && parsed.data.role === 'company') {
        const qs = new URLSearchParams();
        if (parsed.data.company_name) qs.set('name', parsed.data.company_name);
        if (parsed.data.company_website) qs.set('website', parsed.data.company_website);
        if (parsed.data.company_size) qs.set('size', parsed.data.company_size);
        if (parsed.data.company_description) qs.set('desc', parsed.data.company_description);
        window.location.assign('/company/onboarding' + (qs.toString() ? `?${qs}` : ''));
        return;
      }
      window.location.assign(target);
    } catch {
      setError('تعذر إنشاء الحساب حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail ?? email,
      });
      if (err) setError(friendlyAuthError(err.message));
      else setError('أُعيد إرسال رابط التفعيل — تحقق من بريدك');
    } catch {
      setError('تعذر الإرسال حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  if (pendingEmail) {
    return (
      <div className="mx-auto mt-6 max-w-md space-y-4">
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          تم إنشاء حسابك — أرسلنا رابط التفعيل إلى <b dir="ltr">{pendingEmail}</b>. أكّد بريدك ثم سجّل الدخول وستكمل إجاباتك تلقائيًا.
        </p>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={resend} className="flex-1">
            إعادة إرسال الرابط
          </Button>
          <Button type="button" onClick={() => router.push('/login')} className="flex-1">
            الذهاب للدخول
          </Button>
        </div>
      </div>
    );
  }

  const errBox = error && (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </p>
  );

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-5" noValidate>
      <StepIndicator current={step} total={3} />
      {errBox}

      {step === 1 && (
        <>
          {/* Role selector — large accessible cards */}
          <fieldset>
            <legend className="mb-2 text-sm font-bold">أنا سجّل كـ…</legend>
            <div role="radiogroup" aria-label="نوع الحساب" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((opt) => {
                const selected = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRole(opt.value)}
                    className={[
                      'flex min-h-[72px] cursor-pointer flex-col items-start gap-1 rounded-xl border-2 p-3 text-right transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-slate-400 dark:hover:border-slate-500',
                    ].join(' ')}
                  >
                    <span className={['flex h-9 w-9 items-center justify-center rounded-lg', selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'].join(' ')}>
                      <opt.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-black">{opt.title}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="username">اسم المستخدم</Label>
            <Input
              id="username"
              required
              minLength={3}
              dir="ltr"
              placeholder="hunter_eg"
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            {fieldErrors.username && (
              <p id="username-error" className="text-xs font-medium text-destructive">
                {fieldErrors.username}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="full_name">الاسم الكامل</Label>
            <Input
              id="full_name"
              required
              placeholder="أحمد محمد"
              aria-invalid={Boolean(fieldErrors.full_name)}
              aria-describedby={fieldErrors.full_name ? 'full_name-error' : undefined}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            {fieldErrors.full_name && (
              <p id="full_name-error" className="text-xs font-medium text-destructive">
                {fieldErrors.full_name}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              required
              dir="ltr"
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-xs font-medium text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              required
              placeholder="01xxxxxxxxx"
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
              autoComplete="tel"
            />
            {fieldErrors.phone && (
              <p id="phone-error" className="text-xs font-medium text-destructive">
                {fieldErrors.phone}
              </p>
            )}
          </div>
          <div>
            <PasswordField
              id="password"
              label="كلمة السر (8+ أحرف)"
              value={password}
              onChange={setPassword}
              showStrength
              error={fieldErrors.password}
            />
          </div>
          <div>
            <PasswordField
              id="confirmPassword"
              label="تأكيد كلمة السر"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={fieldErrors.confirmPassword}
            />
          </div>

          <Button type="button" onClick={goToStep2} className="h-11 w-full text-base">
            متابعة للتخصيص
            <ArrowLeft className="mr-2 h-4 w-4" />
          </Button>
        </>
      )}

      {step === 2 && role === 'researcher' && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">مستوى خبرتك</legend>
            <div role="radiogroup" aria-label="مستوى الخبرة" className="grid grid-cols-2 gap-2">
              {EXPERIENCE_OPTIONS.map((opt) => {
                const selected = experienceLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setExperienceLevel(selected ? '' : opt.value)}
                    className={[
                      'flex min-h-[64px] cursor-pointer flex-col items-start gap-0.5 rounded-lg border-2 p-2.5 text-right transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:border-slate-400 dark:hover:border-slate-500',
                    ].join(' ')}
                  >
                    <span className="text-sm font-black">{opt.label}</span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="skills">مهاراتك (اختياري)</Label>
            <div className="flex gap-2">
              <Input
                id="skills"
                placeholder="اكتب مهارة واضغط إضافة — مثال: XSS"
                value={skillInput}
                disabled={skillsFull}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (skillInput.trim()) addSkill(skillInput);
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" disabled={!skillInput.trim() || skillsFull} onClick={() => addSkill(skillInput)} aria-label="إضافة مهارة">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {s}
                    <button
                      type="button"
                      onClick={() => setSkills(skills.filter((x) => x !== s))}
                      className="rounded-full p-0.5 hover:bg-background"
                      aria-label={`إزالة ${s}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <span className="self-center text-[11px] text-muted-foreground">{skills.length}/{MAX_SKILLS}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 5).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={skillsFull}
                  onClick={() => addSkill(s)}
                  className="cursor-pointer rounded-full border border-dashed px-2.5 py-1 text-[11px] text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-foreground disabled:opacity-50"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="github">رابط GitHub (اختياري)</Label>
            <Input
              id="github"
              type="url"
              dir="ltr"
              placeholder="https://github.com/username"
              aria-invalid={Boolean(fieldErrors.github)}
              aria-describedby={fieldErrors.github ? 'github-error' : undefined}
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              autoComplete="url"
            />
            {fieldErrors.github && (
              <p id="github-error" className="text-xs font-medium text-destructive">
                {fieldErrors.github}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={backToStep1} className="h-11 flex-1">
              <ArrowRight className="ml-1 h-4 w-4" />
              رجوع
            </Button>
            <Button type="button" onClick={goToStep3} className="h-11 flex-[2] text-base">
              متابعة للموافقة القانونية
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {step === 2 && role === 'company' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="company_name">اسم الشركة</Label>
            <Input
              id="company_name"
              required
              placeholder="مثال: ماسر باونتي"
              aria-invalid={Boolean(fieldErrors.company_name)}
              aria-describedby={fieldErrors.company_name ? 'company_name-error' : undefined}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
            {fieldErrors.company_name && (
              <p id="company_name-error" className="text-xs font-medium text-destructive">
                {fieldErrors.company_name}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_website">موقع الشركة (اختياري)</Label>
            <Input
              id="company_website"
              type="url"
              dir="ltr"
              placeholder="https://example.com"
              aria-invalid={Boolean(fieldErrors.company_website)}
              aria-describedby={fieldErrors.company_website ? 'company_website-error' : undefined}
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              autoComplete="url"
            />
            {fieldErrors.company_website && (
              <p id="company_website-error" className="text-xs font-medium text-destructive">
                {fieldErrors.company_website}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_size">حجم الشركة</Label>
            <select
              id="company_size"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900/50"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
            >
              <option value="">— اختر —</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} موظف
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_description">نبذة عن الشركة (اختياري)</Label>
            <Textarea
              id="company_description"
              rows={3}
              maxLength={1000}
              placeholder="ماذا تعمل شركتك؟ وما المنتج اللي عايزة تحميه؟"
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{companyDescription.length}/1000</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={backToStep1} className="h-11 flex-1">
              <ArrowRight className="ml-1 h-4 w-4" />
              رجوع
            </Button>
            <Button type="button" onClick={goToStep3} className="h-11 flex-[2] text-base">
              متابعة للموافقة القانونية
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            بعد الإنشاء هتكمل خطوتين بسيطتين: إنشاء المؤسسة وتوثيق النطاق.
          </p>
        </>
      )}

      {step === 3 && (
        <>
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
            <h2 className="text-base font-black">الاتفاقية القانونية والأمنية</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              الخطوة الأخيرة قبل تفعيل حسابك. اقرأ الوثائق ثم وافق على جميع البنود — تُسجَّل موافقتك في المنصة مع رقم الإصدار وتاريخ القبول وتأكيد العمر، وهي سجلات غير قابلة للتعديل.
            </p>
          </div>

          <ul className="space-y-2.5">
            {REGISTRATION_CHECKS.map((c) => {
              const checked = agreement[c.id] === true;
              return (
                <li key={c.id}>
                  <label
                    className={[
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-sm leading-relaxed transition-colors duration-150',
                      checked
                        ? 'border-emerald-500 bg-emerald-50/60 dark:border-emerald-600/60 dark:bg-emerald-950/30'
                        : 'border-border hover:border-slate-400 dark:hover:border-slate-500',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setAgreement((s) => ({ ...s, [c.id]: e.target.checked }))}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-emerald-600"
                      aria-label={c.label}
                      required
                    />
                    <span className="flex-1">
                      <span className="font-bold">{c.label}</span>
                      {c.linkSlug && (
                        <>
                          {' '}
                          <Link
                            href={`/legal/${c.linkSlug}`}
                            target="_blank"
                            className="inline-flex items-center gap-0.5 font-bold text-primary underline underline-offset-4"
                          >
                            قراءة الوثيقة
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={backToStep2} className="h-11 flex-1">
              <ArrowRight className="ml-1 h-4 w-4" />
              رجوع
            </Button>
            <Button type="submit" disabled={busy || !agreementValid} className="h-11 flex-[2] text-base" aria-disabled={busy || !agreementValid}>
              {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {busy ? 'جارٍ الإنشاء…' : 'أوافق وأكمل التسجيل'}
            </Button>
          </div>
          {!agreementValid && (
            <p className="text-center text-xs text-muted-foreground">لا يمكن إكمال التسجيل قبل الموافقة على جميع البنود الخمسة.</p>
          )}
        </>
      )}
    </form>
  );
}
