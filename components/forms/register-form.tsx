'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { registerSchema } from '@/schemas/auth';
import { friendlyAuthError } from '@/lib/auth/errors';
import { ensureUserBootstrap } from '@/lib/auth/bootstrap';
import { safeNext } from '@/lib/auth/redirect';
import { resetBrowserSession } from '@/lib/auth/browser-session';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/forms/password-field';

export function RegisterForm({ next = '' }: { next?: string }) {
  const router = useRouter();
  const target = safeNext(next || null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'researcher' | 'company'>('researcher');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = registerSchema.safeParse({
      username: username.trim(),
      email: email.trim(),
      password,
      confirmPassword,
      full_name: fullName.trim(),
      phone: phone.trim(),
      role,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const nextFieldErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat.fieldErrors)) {
        if (v && v[0]) nextFieldErrors[k] = v[0];
      }
      setFieldErrors(nextFieldErrors);
      setError('بيانات التسجيل غير صالحة — راجع الحقول');
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
      await ensureUserBootstrap(supabase, data.user.id, {
        username: parsed.data.username,
        role: parsed.data.role,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
      });
      // Companies start at company onboarding; explicit ?next= wins.
      if (!next && parsed.data.role === 'company') {
        window.location.assign('/company/settings');
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
      setError('تعذر الإرسال حاليًا — Attempt later');
    } finally {
      setBusy(false);
    }
  }

  if (pendingEmail) {
    return (
      <div className="max-w-md mx-auto mt-6 space-y-4 p-6 bg-background/90 backdrop-blur rounded-xl border border-border">
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          تم إنشاء حسابك — أرسلنا رابط التفعيل إلى <b dir="ltr">{pendingEmail}</b>. أكّد بريدك ثم سجّل الدخول.
        </p>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={resend} className="flex-1">
            إعادة إرسال الرابط
          </Button>
          <Button type="button" onClick={() => router.push('/login')} className="flex-1 bg-slate-900 text-white hover:bg-slate-700">
            الذهاب للدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4 p-6 bg-background/90 backdrop-blur rounded-xl border border-border">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <Label htmlFor="username" className="block mb-1 font-medium text-foreground">
          اسم المستخدم
        </Label>
        <Input
          id="username"
          required
          minLength={3}
          dir="ltr"
          placeholder="hunter_eg"
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={fieldErrors.username ? 'username-error' : undefined}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {fieldErrors.username && (
          <p id="username-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.username}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="email" className="block mb-1 font-medium text-foreground">
          البريد الإلكتروني
        </Label>
        <Input
          id="email"
          type="email"
          required
          dir="ltr"
          placeholder="you@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {fieldErrors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="full_name" className="block mb-1 font-medium text-foreground">
          الاسم الكامل
        </Label>
        <Input
          id="full_name"
          required
          placeholder="أحمد محمد"
          aria-invalid={Boolean(fieldErrors.full_name)}
          aria-describedby={fieldErrors.full_name ? 'full_name-error' : undefined}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        {fieldErrors.full_name && (
          <p id="full_name-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.full_name}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="phone" className="block mb-1 font-medium text-foreground">
          رقم الهاتف
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          dir="ltr"
          required
          placeholder="01xxxxxxxxx"
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
        />
        {fieldErrors.phone && (
          <p id="phone-error" className="mt-1 text-sm text-red-600">
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
        />
        {fieldErrors.password && (
          <p id="password-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>
      <div>
        <PasswordField
          id="confirmPassword"
          label="تأكيد كلمة السر"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
        {fieldErrors.confirmPassword && (
          <p id="confirmPassword-error" className="mt-1 text-sm text-red-600">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="role" className="block mb-1 font-medium text-foreground">
          أنا…
        </Label>
        <select
          id="role"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={role}
          onChange={(e) => setRole(e.target.value as 'researcher' | 'company')}
        >
          <option value="researcher">باحث أمني — أكتشف وأكسب</option>
          <option value="company">شركة — عايز أحمي منتجي</option>
        </select>
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
      </Button>
    </form>
  );
}