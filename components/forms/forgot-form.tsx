'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/auth/errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes('@')) {
      setError('بريد غير صالح');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
      });
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      setSent(true);
    } catch {
      setError('تعذر الإرسال حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">أرسلنا رابط الاستعادة لبريدك — افتحه خلال ساعة.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" type="email" required dir="ltr" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
        {busy ? 'جارٍ الإرسال…' : 'إرسال الرابط'}
      </Button>
    </form>
  );
}
