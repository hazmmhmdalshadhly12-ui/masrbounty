'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { registerSchema } from '@/schemas/auth';
import { friendlyAuthError } from '@/lib/auth/errors';
import { ensureUserBootstrap } from '@/lib/auth/bootstrap';
import { safeNext } from '@/lib/auth/redirect';
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
  const [role, setRole] = useState<'researcher' | 'company'>('researcher');
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse({ username, email, password, role });
    if (!parsed.success) {
      setError('بيانات التسجيل غير صالحة — راجع الحقول');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { username: parsed.data.username, role: parsed.data.role },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
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
      });
      // Verify the server sees the session before navigating.
      setBusy(true);
      const start = Date.now();
      let seen = false;
      while (Date.now() - start < 9000 && !seen) {
        try {
          const r = await fetch(`/api/diag?t=${Date.now()}`, { cache: 'no-store' });
          if (r.ok) {
            const j = (await r.json()) as { result?: string };
            seen = j.result === 'AUTHENTICATED';
          }
        } catch {
          /* retry */
        }
        if (!seen) await new Promise((res) => setTimeout(res, 600));
      }
      if (!seen) {
        setError('تم إنشاء الحساب لكن الخادم لم يستلم الجلسة — سجّل الدخول من صفحة الدخول');
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
      <div className="mt-6 space-y-4">
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
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <Label htmlFor="username">اسم المستخدم</Label>
        <Input id="username" required minLength={3} dir="ltr" placeholder="hunter_eg" className="mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" type="email" required dir="ltr" placeholder="you@example.com" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <PasswordField id="password" label="كلمة السر (8+ أحرف)" value={password} onChange={setPassword} showStrength />
      </div>
      <div>
        <Label htmlFor="role">أنا…</Label>
        <select
          id="role"
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as 'researcher' | 'company')}
        >
          <option value="researcher">باحث أمني — أكتشف وأكسب</option>
          <option value="company">شركة — عايز أحمي منتجي</option>
        </select>
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
        {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
      </Button>
    </form>
  );
}
