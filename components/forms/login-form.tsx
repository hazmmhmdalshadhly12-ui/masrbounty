'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loginSchema } from '@/schemas/auth';
import { friendlyAuthError } from '@/lib/auth/errors';
import { ensureUserBootstrap } from '@/lib/auth/bootstrap';
import { safeNext } from '@/lib/auth/redirect';
import { roleHome } from '@/lib/auth/home';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/forms/password-field';
import { resetBrowserSession } from '@/lib/auth/browser-session';

/** True when the browser actually persisted a Supabase session cookie. */
function hasSessionCookie(): boolean {
  return document.cookie
    .split(';')
    .map((c) => c.trim())
    .some((c) => c.startsWith('sb-') && c.includes('-auth-token') && !c.includes('code-verifier'));
}

export function LoginForm({ next = '' }: { next?: string }) {
  const target = safeNext(next || null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('صيغة الدخول غير صالحة');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      // Clean slate: stale cookies from older accounts shadow new sessions
      await resetBrowserSession(supabase);
      const { data, error: err } = await supabase.auth.signInWithPassword(parsed.data);
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', data.user.id).single();
        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          setError('تم إيقاف حسابك — يمكنك تقديم استئناف من صفحة الاستئناف');
          return;
        }
        await ensureUserBootstrap(supabase, data.user.id, {
          username: (data.user.user_metadata?.username as string) ?? undefined,
          role: (data.user.user_metadata?.role as string) ?? undefined,
          full_name: (data.user.user_metadata?.full_name as string) ?? undefined,
          phone: (data.user.user_metadata?.phone as string) ?? undefined,
          // Registration-wizard answers (applied only on first row creation)
          experience_level: (data.user.user_metadata?.experience_level as string) ?? undefined,
          skills: (data.user.user_metadata?.skills as string) ?? undefined,
          github: (data.user.user_metadata?.github as string) ?? undefined,
          website: (data.user.user_metadata?.website as string) ?? undefined,
        });
      }
      if (!hasSessionCookie()) {
        setError('المتصفح رفض حفظ جلسة الدخول — تأكد أن الرابط يبدأ بـ https (قفل الأمان) وعطّل مانع الإعلانات/التتبع ثم حاول مجددًا');
        return;
      }
      // Legal gate: outstanding policy re-acceptances block the dashboards.
      // Versions + records are resolved server-side; nothing is guessed here.
      let landing = target;
      if (!next && data.user) {
        landing = await roleHome(supabase, data.user.id);
      }
      try {
        const { data: required } = await supabase.rpc('get_required_legal_docs', { p_user: data.user?.id ?? null });
        if ((required ?? []).length > 0) {
          window.location.assign(`/legal/consent?next=${encodeURIComponent(landing)}`);
          return;
        }
      } catch {
        /* gate check must never block login on transient errors */
      }
      // Role-aware landing (?next= wins); hard navigation carries the cookies.
      window.location.assign(landing);
    } catch {
      setError('تعذر تسجيل الدخول حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-md space-y-5"
    >
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          dir="ltr"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <PasswordField id="password" label="كلمة السر" value={password} onChange={setPassword} />
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'جارٍ الدخول…' : 'دخول'}
      </Button>
    </form>
  );
}
