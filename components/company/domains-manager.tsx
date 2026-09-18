'use client';

import * as React from 'react';
import { Copy, Check, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
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
      <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
        {text}
      </code>
      <Button size="sm" variant="outline" onClick={copy} className="h-7 gap-1 text-xs">
        {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        {done ? 'تم النسخ' : 'نسخ'}
      </Button>
    </span>
  );
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
    setMsg(r.ok ? { ok: true, text: 'تمت إضافة النطاق' } : { ok: false, text: r.error ?? 'فشل' });
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
    else setTimeout(() => window.location.reload(), 1000);
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
        <p className="text-xs text-muted-foreground">أضف نطاقات شركتك ووثّق ملكيتها عبر سجل DNS TXT. التوثيق مطلوب لنشر البرامج.</p>
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
            return (
              <div key={d.id} className={['rounded-lg border p-3', verified ? 'border-emerald-200 bg-emerald-50/50' : 'bg-card'].join(' ')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span dir="ltr" className="font-mono text-sm font-bold">
                    {d.domain}
                  </span>
                  {verified ? <Badge className="bg-emerald-600">موثّق ✓</Badge> : d.status === 'failed' ? <Badge variant="destructive">فشل</Badge> : <Badge variant="secondary">قيد الانتظار</Badge>}
                </div>
                {!verified ? (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">سجل TXT — host:</span>
                      <CopyInline text={host} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">القيمة:</span>
                      <CopyInline text={txt} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handleVerify(d.id)} disabled={pending === `verify-${d.id}`}>
                        {pending === `verify-${d.id}` && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        تحقق الآن
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
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)} disabled={pending === `del-${d.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
        <p className="text-xs text-muted-foreground">بعد إضافة السجل TXT، انتظر دقيقة ثم اضغط “تحقق الآن”. نتحقق من السجل على <code dir="ltr">_masrbounty.{'{domain}'}</code> أو جذر النطاق.</p>
      </CardContent>
    </Card>
  );
}
