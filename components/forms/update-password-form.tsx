'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/auth/errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function UpdatePasswordForm({ serverError }: { serverError?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(serverError ?? null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('كلمة السر 8 أحرف على الأقل');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      router.push('/login?ok=' + encodeURIComponent('تم تغيير كلمة السر — سجّل الدخول'));
    } catch {
      setError('تعذر الحفظ حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <Label htmlFor="password">كلمة السر الجديدة (8+ أحرف)</Label>
        <Input id="password" type="password" required minLength={8} dir="ltr" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
        {busy ? 'جارٍ الحفظ…' : 'حفظ'}
      </Button>
    </form>
  );
}
