'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, Globe, ShieldCheck, BadgeCheck, Copy, Check, Loader2, Trash2, Shield, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { addDomainAction, createOrganizationAction, deleteDomainAction, verifyDomainAction } from '@/app/company/onboarding/actions';

type WizardDomain = {
  id: string;
  domain: string;
  token: string;
  status: string;
  verified_at: string | null;
  created_at: string;
  expires_at?: string | null;
};

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

type WizardCompany = {
  id: string;
  name: string;
  slug: string;
} | null;

interface Props {
  company: WizardCompany;
  domains: WizardDomain[];
  currentStep: number; // 1..4
  isVerified: boolean;
}

const steps = [
  { n: 1, label: 'إنشاء المؤسسة', icon: Building2 },
  { n: 2, label: 'إضافة النطاق', icon: Globe },
  { n: 3, label: 'توثيق النطاق', icon: ShieldCheck },
  { n: 4, label: 'مؤسسة موثّقة', icon: BadgeCheck },
] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div dir="rtl" className="mb-8">
      <ol className="flex items-center justify-between gap-2">
        {steps.map((s, idx) => {
          const status: 'done' | 'current' | 'pending' = s.n < current ? 'done' : s.n === current ? 'current' : 'pending';
          return (
            <React.Fragment key={s.n}>
              <li className="flex flex-1 flex-col items-center gap-2 text-center">
                <span
                  className={[
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black transition-colors duration-150 shadow-sm',
                    status === 'done' ? 'border-emerald-600 bg-emerald-600 text-white' : '',
                    status === 'current' ? 'border-primary bg-primary text-primary-foreground' : '',
                    status === 'pending' ? 'border-muted bg-muted text-muted-foreground' : '',
                  ].join(' ')}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {status === 'done' ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </span>
                <span className={['text-xs font-bold leading-tight', status === 'current' ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
                  {s.label}
                </span>
                <Badge variant={status === 'done' ? 'default' : status === 'current' ? 'secondary' : 'outline'} className="hidden text-[10px] sm:inline-flex">
                  {status === 'done' ? 'مكتمل' : status === 'current' ? 'حالي' : 'قادم'}
                </Badge>
              </li>
              {idx < steps.length - 1 && (
                <span className={['hidden h-0.5 flex-1 rounded sm:block', s.n < current ? 'bg-emerald-600' : 'bg-muted'].join(' ')} aria-hidden />
              )}
            </React.Fragment>
          );
        })}
      </ol>
      {/* progress bar */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all duration-150" style={{ width: `${(current / 4) * 100}%` }} />
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">الخطوة {current} من 4</p>
    </div>
  );
}

function TxtCopy({ value }: { value: string }) {
  const [done, setDone] = React.useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  }
  return (
    <span className="inline-flex items-center gap-2">
      <code dir="ltr" className="rounded bg-muted px-2 py-1 font-mono text-xs break-all">
        {value}
      </code>
      <Button size="sm" variant="outline" onClick={copy} className="h-7 gap-1 text-xs">
        {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {done ? 'تم النسخ' : 'نسخ'}
      </Button>
    </span>
  );
}

export function OnboardingWizard({ company, domains, currentStep, isVerified }: Props) {
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const primaryDomain = domains[0] ?? null;

  async function handleCreate(formData: FormData) {
    setPendingAction('create');
    setMsg(null);
    const r = await createOrganizationAction(formData);
    setMsg(r.ok ? { ok: true, text: 'تم إنشاء المؤسسة بنجاح — تابع لإضافة النطاق' } : { ok: false, text: r.error ?? 'فشل' });
    setPendingAction(null);
    if (r.ok) window.location.reload();
  }

  async function handleAdd(formData: FormData) {
    setPendingAction('add');
    setMsg(null);
    const r = await addDomainAction(formData);
    setMsg(r.ok ? { ok: true, text: 'تمت إضافة النطاق — أضف سجل TXT ثم اضغط تحقق' } : { ok: false, text: r.error ?? 'فشل' });
    setPendingAction(null);
    if (r.ok) window.location.reload();
  }

  async function handleVerify(domainId: string) {
    setPendingAction(`verify-${domainId}`);
    setMsg(null);
    const fd = new FormData();
    fd.set('domain_id', domainId);
    const r = await verifyDomainAction(fd);
    setMsg(r.ok ? { ok: true, text: 'تم التوثيق بنجاح ✓' } : { ok: false, text: r.error ?? 'لم يتم العثور على السجل بعد — تأكد من DNS ثم حاول مجددًا' });
    setPendingAction(null);
    if (r.ok) window.location.reload();
    else setTimeout(() => window.location.reload(), 1200);
  }

  async function handleDelete(domainId: string) {
    if (!confirm('حذف النطاق؟')) return;
    setPendingAction(`del-${domainId}`);
    const fd = new FormData();
    fd.set('domain_id', domainId);
    const r = await deleteDomainAction(fd);
    setMsg(r.ok ? { ok: true, text: 'تم حذف النطاق' } : { ok: false, text: r.error ?? 'فشل الحذف' });
    setPendingAction(null);
    if (r.ok) window.location.reload();
  }

  return (
    <div dir="rtl" className="space-y-6">
      <Stepper current={currentStep} />

      {msg && (
        <div className={['rounded-lg border p-3 text-sm', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'].join(' ')}>
          {msg.text}
        </div>
      )}

      {/* STEP 1 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> الخطوة 1 — إنشاء المؤسسة
            </CardTitle>
            <CardDescription>أنشئ ملف شركتك لبدء التوثيق واستقبال التقارير. ستصبح المالك (owner).</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async (fd: FormData) => {
                await handleCreate(fd);
              }}
              className="space-y-3"
            >
              <Input name="name" required placeholder="اسم الشركة (مثال: ماسر باونتي)" />
              <Input name="slug" required placeholder="المعرّف (slug) — مثال: masrbounty" dir="ltr" />
              <Input name="description" placeholder="نبذة مختصرة عن الشركة (اختياري)" />
              <Input name="website" placeholder="الموقع (https://…)" dir="ltr" />
              <Button type="submit" disabled={pendingAction === 'create'} className="w-full">
                {pendingAction === 'create' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إنشاء المؤسسة
              </Button>
              <p className="text-xs text-muted-foreground">بالإنشاء توافق على شروط المنصة وسياسة التجريب الآمن.</p>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2 */}
      {currentStep === 2 && company && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> الخطوة 2 — إضافة النطاق المؤسسي
            </CardTitle>
            <CardDescription>
              أضف نطاق شركتك الرسمي (مثال: <b dir="ltr">example.com</b>). سنستخدمه للتحقق من ملكية المؤسسة عبر سجل DNS TXT.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <span className="font-bold">المؤسسة:</span> {company.name} <span className="text-muted-foreground" dir="ltr">({company.slug})</span>
            </div>
            <form
              action={async (fd: FormData) => {
                await handleAdd(fd);
              }}
              className="flex gap-2"
            >
              <input type="hidden" name="company_id" value={company.id} />
              <Input name="domain" required placeholder="example.com" dir="ltr" className="flex-1" />
              <Button type="submit" disabled={pendingAction === 'add'}>
                {pendingAction === 'add' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إضافة النطاق
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">يمكن إضافة أكثر من نطاق لاحقًا من الإعدادات. يكفي توثيق نطاق واحد لإكمال هذه الخطوة.</p>
          </CardContent>
        </Card>
      )}

      {/* STEP 3 */}
      {currentStep === 3 && company && primaryDomain && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> الخطوة 3 — توثيق النطاق
            </CardTitle>
            <CardDescription>أضف سجل TXT التالي في إعدادات DNS للنطاق ثم اضغط تحقق.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {domains.map((d) => {
              const txt = `masrbounty-verification=${d.token}`;
              const host = `_masrbounty.${d.domain}`;
              const isPending = d.status !== 'verified';
              const countdown = expiryCountdown(d.expires_at);
              const expired = d.status === 'expired';
              return (
                <div key={d.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span dir="ltr" className="font-mono text-sm font-bold">
                      {d.domain}
                    </span>
                    {d.status === 'verified' ? (
                      <Badge className="bg-emerald-600">موثّق ✓</Badge>
                    ) : d.status === 'failed' ? (
                      <Badge variant="destructive">فشل — حاول مجددًا</Badge>
                    ) : expired ? (
                      <Badge variant="destructive">منتهي</Badge>
                    ) : (
                      <Badge variant="secondary">بانتظار التوثيق</Badge>
                    )}
                  </div>
                  {countdown && (
                    <div className={['flex items-center gap-1.5 text-xs', countdown.urgent ? 'text-amber-700' : 'text-muted-foreground'].join(' ')}>
                      {countdown.urgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      <span>{countdown.label}</span>
                      {d.expires_at && <span className="text-[11px]">({new Date(d.expires_at).toLocaleDateString('ar-EG')})</span>}
                    </div>
                  )}

                  {isPending ? (
                    <>
                      <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                        <p className="font-bold">أضف سجل DNS TXT:</p>
                        <div className="grid gap-1 text-xs">
                          <div className="flex flex-wrap gap-2">
                            <span className="text-muted-foreground">النوع:</span> <b>TXT</b>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-muted-foreground">الاسم / Host:</span> <TxtCopy value={host} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-muted-foreground">القيمة:</span> <TxtCopy value={txt} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">قد يستغرق انتشار DNS بضع دقائق. يمكنك التحقق بعد 1–5 دقائق.</p>
                        <p className="text-[11px] text-amber-700">الرمز يظهر مرة واحدة — يُخزن كـ hash بعد الحفظ. انسخه الآن.</p>
                        {expired && <p className="text-xs font-bold text-red-700">انتهت صلاحية التوثيق (90 يوم) — أعد التحقق بعد تجديد السجل.</p>}
                        {d.status === 'failed' && <p className="text-xs text-red-700">فشل التحقق الأخير — تأكد من السجل ثم اضغط إعادة تحقق.</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleVerify(d.id)} disabled={pendingAction === `verify-${d.id}`} size="sm">
                          {pendingAction === `verify-${d.id}` && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                          <Shield className="ml-1 h-4 w-4" />
                          {d.status === 'failed' || expired ? 'إعادة تحقق' : 'تحقق الآن'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(d.id)} disabled={pendingAction === `del-${d.id}`}>
                          <Trash2 className="ml-1 h-4 w-4" />
                          حذف
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-emerald-700">تم التوثيق — انتقل للخطوة التالية.</p>
                      {d.expires_at && <p className="text-xs text-muted-foreground">صالح حتى {new Date(d.expires_at).toLocaleDateString('ar-EG')} — {countdown?.label ?? ''}</p>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* add another domain inline */}
            <form
              action={async (fd: FormData) => {
                await handleAdd(fd);
              }}
              className="flex gap-2 border-t pt-4"
            >
              <input type="hidden" name="company_id" value={company.id} />
              <Input name="domain" placeholder="إضافة نطاق آخر (اختياري)" dir="ltr" className="flex-1" />
              <Button type="submit" variant="secondary" disabled={pendingAction === 'add'}>
                إضافة
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 4 */}
      {currentStep === 4 && company && isVerified && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-6 w-6" /> المؤسسة موثّقة بنجاح ✓
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-400">
              تم توثيق ملكية النطاق. يمكنك الآن إنشاء برامج المكافآت واستقبال التقارير.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {domains
                .filter((d) => d.status === 'verified')
                .map((d) => (
                  <Badge key={d.id} className="bg-emerald-600">
                    {d.domain} — موثّق
                  </Badge>
                ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/company/programs/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-colors duration-150 hover:bg-primary/90">
                إنشاء برنامج +
              </Link>
              <Link href="/company/settings" className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-6 text-sm font-bold shadow-sm transition-colors duration-150 hover:bg-accent hover:text-accent-foreground">
                الإعدادات
              </Link>
              <Link href="/company" className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-6 text-sm transition-colors duration-150 hover:bg-accent hover:text-accent-foreground">
                لوحة التحكم
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">شارة "موثّق" ستظهر على ملف شركتك وبرامجك للباحثين.</p>
          </CardContent>
        </Card>
      )}

      {/* show context when step 3 but no domain (edge) */}
      {currentStep === 3 && !primaryDomain && company && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">لا يوجد نطاق — أضف نطاقًا أولًا.</CardContent>
        </Card>
      )}
    </div>
  );
}
