'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { loginSchema } from '@/schemas/auth';
import { friendlyAuthError } from '@/lib/auth/errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function LoginForm() {
  const router = useRouter();
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
      const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('تعذر تسجيل الدخول حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
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
      <div>
        <Label htmlFor="password">كلمة السر</Label>
        <Input
          id="password"
          type="password"
          required
          dir="ltr"
          placeholder="••••••••"
          className="mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
        {busy ? 'جارٍ الدخول…' : 'دخول'}
      </Button>
    </form>
  );
}
