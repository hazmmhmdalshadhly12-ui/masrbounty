'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { registerSchema } from '@/schemas/auth';
import { friendlyAuthError } from '@/lib/auth/errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'researcher' | 'company'>('researcher');
  const [error, setError] = useState<string | null>(null);
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
        options: { data: { username: parsed.data.username, role: parsed.data.role } },
      });
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      if (!data.user) {
        setError('فشل إنشاء الحساب — حاول مرة أخرى');
        return;
      }
      // Profile row (RLS: own insert)
      const { error: pErr } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, username: parsed.data.username });
      if (pErr) {
        setError(
          pErr.message.includes('duplicate') || pErr.code === '23505'
            ? 'اسم المستخدم مستخدم بالفعل — اختر اسمًا آخر'
            : friendlyAuthError(pErr.message)
        );
        return;
      }
      const { error: rErr } = await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: parsed.data.role });
      if (rErr) {
        setError(friendlyAuthError(rErr.message));
        return;
      }
      if (parsed.data.role === 'researcher') {
        // Wallet/reputation/stats rows are auto-created by DB trigger
        const { error: rpErr } = await supabase
          .from('researcher_profiles')
          .insert({ user_id: data.user.id, display_name: parsed.data.username });
        if (rpErr) {
          setError(friendlyAuthError(rpErr.message));
          return;
        }
      }
      router.push('/login?ok=' + encodeURIComponent('تم إنشاء الحساب — سجّل الدخول الآن'));
    } catch {
      setError('تعذر إنشاء الحساب حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
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
        <Label htmlFor="password">كلمة السر (8+ أحرف)</Label>
        <Input id="password" type="password" required minLength={8} dir="ltr" placeholder="••••••••" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
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
