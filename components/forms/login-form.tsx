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
        });
      }
      if (!hasSessionCookie()) {
        setError('المتصفح رفض حفظ جلسة الدخول — تأكد أن الرابط يبدأ بـ https (قفل الأمان) وعطّل مانع الإعلانات/التتبع ثم حاول مجددًا');
        return;
      }
      // Role-aware landing (?next= wins); hard navigation carries the cookies.
      if (next) {
        window.location.assign(target);
        return;
      }
      window.location.assign(await roleHome(supabase, data.user.id));
    } catch {
      setError('تعذر تسجيل الدخول حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          type="email"
          required
          dir="ltr"
          placeholder="you@example.com"
          className="mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <PasswordField id="password" label="كلمة السر" value={password} onChange={setPassword} />
      <Button type="submit" disabled={busy} className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
        {busy ? 'جارٍ الدخول…' : 'دخول'}
      </Button>
    </form>
  );
}
