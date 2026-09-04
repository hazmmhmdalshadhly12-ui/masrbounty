'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/auth/errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function strength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Zء-غ]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9ء-غ]/.test(pw)) s++;
  const labels = ['ضعيفة جدًا', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية', 'ممتازة'];
  return { score: Math.min(s, 5), label: labels[Math.min(s, 5)] };
}

export function UpdatePasswordForm({ serverError }: { serverError?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(serverError ?? null);
  const [busy, setBusy] = useState(false);
  const st = useMemo(() => strength(password), [password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('كلمة السر 8 أحرف على الأقل');
      return;
    }
    if (password !== confirm) {
      setError('تأكيد كلمة السر غير متطابق');
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
        <div className="relative mt-1">
          <Input
            id="password"
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            dir="ltr"
            className="pl-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            aria-label={show ? 'إخفاء' : 'إظهار'}
            onClick={() => setShow((s) => !s)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password.length > 0 && (
          <div className="mt-2">
            <div className="flex h-1.5 gap-1" dir="ltr">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'flex-1 rounded-full',
                    i <= st.score ? (st.score >= 3 ? 'bg-emerald-500' : st.score === 2 ? 'bg-amber-500' : 'bg-red-500') : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">القوة: {st.label}</p>
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="confirm">تأكيد كلمة السر</Label>
        <Input
          id="confirm"
          type={show ? 'text' : 'password'}
          required
          dir="ltr"
          className="mt-1"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
        {busy ? 'جارٍ الحفظ…' : 'حفظ'}
      </Button>
    </form>
  );
}
