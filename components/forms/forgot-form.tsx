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
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" type="email" required dir="ltr" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'جارٍ الإرسال…' : 'إرسال الرابط'}
      </Button>
    </form>
  );
}
