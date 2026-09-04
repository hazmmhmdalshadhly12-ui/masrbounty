'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Factor {
  id: string;
  friendly_name?: string;
  status: string;
}

export function MfaPanel() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors([...(data?.totp ?? []), ...(data?.phone ?? [])] as Factor[]);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startEnroll() {
    setMsg(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'authenticator' });
      if (error || !data) {
        setMsg('تعذر بدء التسجيل — حاول لاحقًا');
        return;
      }
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (code.trim().length < 6) {
      setMsg('أدخل الرمز المكون من 6 أرقام');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (!enroll) return;
      const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.id });
      if (challenge.error) {
        setMsg('تعذر التحقق — حاول مجددًا');
        return;
      }
      const { error } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: challenge.data.id, code: code.trim() });
      if (error) {
        setMsg('الرمز غير صحيح — تحقق وحاول مجددًا');
        return;
      }
      setEnroll(null);
      setCode('');
      setMsg('تم تفعيل المصادقة الثنائية بنجاح');
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) setMsg('تعذر الإزالة — حاول لاحقًا');
      else {
        setMsg('تم إيقاف المصادقة الثنائية');
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {msg && <p className="rounded-md bg-muted p-2 text-sm">{msg}</p>}
      {factors.length === 0 && !enroll && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">غير مفعّلة — نوصي بها بشدة لحماية حسابك ومحفظتك.</p>
          <Button size="sm" disabled={busy} onClick={startEnroll}>تفعيل</Button>
        </div>
      )}
      {factors.map((f) => (
        <div key={f.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
          <span>{f.friendly_name || 'Authenticator'} — {f.status}</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => remove(f.id)}>إيقاف</Button>
        </div>
      ))}
      {enroll && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-bold">امسح الرمز بتطبيق المصادقة ثم أدخل الكود:</p>
          <div className="mx-auto w-fit bg-white p-2 [&_svg]:h-40 [&_svg]:w-40" dangerouslySetInnerHTML={{ __html: enroll.qr }} />
          <p className="text-center font-mono text-xs text-muted-foreground" dir="ltr">{enroll.secret}</p>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" dir="ltr" maxLength={8} inputMode="numeric" />
            <Button size="sm" disabled={busy} onClick={confirmEnroll}>تأكيد</Button>
          </div>
        </div>
      )}
    </div>
  );
}
