'use client';

import * as React from 'react';
import { Copy, Check, Trash2, ShieldCheck, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addDomainAction, verifyDomainAction, deleteDomainAction } from '@/app/company/onboarding/actions';

type DomainRow = {
  id: string;
  domain: string;
  token: string;
  status: string;
  verified_at: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

function CopyInline({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* ignore */
    }
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
        {text}
      </code>
      <Button size="sm" variant="outline" onClick={copy} className="h-7 gap-1 text-xs">
        {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        {done ? 'تم النسخ' : 'نسخ'}
      </Button>
    </span>
  );
}

function expiryCountdown(expiresAt: string | null | undefined): { label: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: 'منتهي — يحتاج تجديد', urgent: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return { label: `ينتهي خلال ${days} يوم${hours ? ` و ${hours} ساعة` : ''}`, urgent: days <= 7 };
  if (hours > 0) return { label: `ينتهي خلال ${hours} ساعة`, urgent: true };
  const mins = Math.floor((diff % 3600000) / 60000);
  return { label: `ينتهي خلال ${mins} دقيقة`, urgent: true };
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'verified') return <Badge className="bg-emerald-600">موثّق ✓</Badge>;
  if (status === 'failed') return <Badge variant="destructive">فشل</Badge>;
  if (status === 'expired') return <Badge variant="destructive">منتهي</Badge>;
  return <Badge variant="secondary">قيد الانتظار</Badge>;
}

export function DomainsManager({ companyId, initialDomains }: { companyId: string; initialDomains: DomainRow[] }) {
  const [domains] = React.useState<DomainRow[]>(initialDomains);
  const [pending, setPending] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [input, setInput] = React.useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const clean = input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!clean) return;
    setPending('add');
    setMsg(null);
    const fd = new FormData();
    fd.set('company_id', companyId);
    fd.set('domain', clean);
    const r = await addDomainAction(fd);
    setMsg(r.ok ? { ok: true, text: 'تمت إضافة النطاق — انسخ سجل TXT الآن (يظهر مرة واحدة)' } : { ok: false, text: r.error ?? 'فشل' });
    setPending(null);
    if (r.ok) window.location.reload();
  }

  async function handleVerify(id: string) {
    setPending(`verify-${id}`);
    setMsg(null);
    const fd = new FormData();
    fd.set('domain_id', id);
    const r = await verifyDomainAction(fd);
    setMsg(r.ok ? { ok: true, text: 'تم التوثيق ✓' } : { ok: false, text: r.error ?? 'لم يتم العثور على السجل' });
    setPending(null);
    if (r.ok) window.location.reload();
    else setTimeout(() => window.location.reload(), 1200);
  }

  async function handleDelete(id: string) {
    if (!confirm('حذف النطاق؟')) return;
    setPending(`del-${id}`);
    const fd = new FormData();
    fd.set('domain_id', id);
    const r = await deleteDomainAction(fd);
    setMsg(r.ok ? { ok: true, text: 'تم الحذف' } : { ok: false, text: r.error ?? 'فشل' });
    setPending(null);
    if (r.ok) window.location.reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> النطاقات المؤسسية
        </CardTitle>
        <p className="text-xs text-muted-foreground">أضف نطاقات شركتك ووثّق ملكيتها عبر سجل DNS TXT. التوثيق مطلوب لنشر البرامج. الرمز يظهر مرة واحدة — احفظه ثم أضفه كسجل TXT.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <div className={['rounded border p-2 text-xs', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'].join(' ')}>
            {msg.text}
          </div>
        )}

        {domains.length === 0 && <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">لا توجد نطاقات بعد — أضف نطاق شركتك أدناه.</p>}

        <div className="space-y-3">
          {domains.map((d) => {
            const txt = `masrbounty-verification=${d.token}`;
            const host = `_masrbounty.${d.domain}`;
            const verified = d.status === 'verified';
            const expired = d.status === 'expired';
            const failed = d.status === 'failed';
            const countdown = expiryCountdown(d.expires_at);
            const showToken = !verified; // secure: hide token once verified
            return (
              <div key={d.id} className={['rounded-lg border p-3', verified ? 'border-emerald-200 bg-emerald-50/50' : expired ? 'border-red-200 bg-red-50/40' : 'bg-card'].join(' ')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span dir="ltr" className="font-mono text-sm font-bold">
                    {d.domain}
                  </span>
                  <StatusBadge status={d.status} />
                </div>
                {/* expiry countdown */}
                {countdown && (
                  <div className={['mt-2 flex items-center gap-1.5 text-xs', countdown.urgent ? 'text-amber-700' : 'text-muted-foreground'].join(' ')}>
                    {countdown.urgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    <span>{countdown.label}</span>
                    {d.expires_at && <span className="text-[11px]">({new Date(d.expires_at).toLocaleDateString('ar-EG')})</span>}
                  </div>
                )}
                {/* verified expiry info even if countdown hidden */}
                {verified && d.expires_at && !countdown && (
                  <p className="mt-1 text-xs text-muted-foreground">ينتهي: {new Date(d.expires_at).toLocaleDateString('ar-EG')}</p>
                )}
                {!verified ? (
                  <div className="mt-3 space-y-2 text-xs">
                    {showToken ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">سجل TXT — host:</span>
                          <CopyInline text={host} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">القيمة:</span>
                          <CopyInline text={txt} />
                        </div>
                        <p className="text-[11px] text-amber-700">انسخ القيمة الآن — الرمز يُخزن كـ hash ولن يظهر كاملاً مرة أخرى بعد التحديث.</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">الرمز مُخفي لأسباب أمنية — أعد إنشاء النطاق لإظهار رمز جديد.</p>
                    )}
                    {failed && <p className="text-red-700">فشل التحقق الأخير — تأكد من انتشار DNS ثم اضغط إعادة تحقق.</p>}
                    {expired && <p className="text-red-700">انتهت صلاحية التوثيق (90 يوم) — أضف النطاق مرة أخرى أو احذفه وأعد إنشاءه.</p>}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handleVerify(d.id)} disabled={pending === `verify-${d.id}`}>
                        {pending === `verify-${d.id}` && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        {failed || expired ? 'إعادة تحقق' : 'تحقق الآن'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(d.id)} disabled={pending === `del-${d.id}`}>
                        <Trash2 className="ml-1 h-3 w-3" />
                        حذف
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-emerald-700">تم التوثيق {d.verified_at ? `— ${new Date(d.verified_at).toLocaleDateString('ar-EG')}` : ''}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleVerify(d.id)} disabled={pending === `verify-${d.id}`}>
                        {pending === `verify-${d.id}` && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        إعادة تحقق
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)} disabled={pending === `del-${d.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 border-t pt-4">
          <Input value={input} onChange={(e) => setInput(e.target.value)} required placeholder="example.com" dir="ltr" className="flex-1" />
          <Button type="submit" disabled={pending === 'add'}>
            {pending === 'add' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            إضافة نطاق
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">بعد إضافة السجل TXT، انتظر دقيقة ثم اضغط “تحقق الآن”. نتحقق من السجل على <code dir="ltr">_masrbounty.{'{domain}'}</code> أو جذر النطاق. التوثيق صالح 90 يومًا.</p>
      </CardContent>
    </Card>
  );
}
