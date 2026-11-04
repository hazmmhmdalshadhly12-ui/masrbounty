'use client';
import * as React from 'react';
import { useWizardStore } from '../store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Copy, ExternalLink, ShieldCheck, Loader2, AlertTriangle, RefreshCw, Globe, BadgeCheck } from 'lucide-react';
import { createVerificationTokenAction, verifyDomainFileAction, verifyDomainTxtAction, getVerifiedDomainsAction } from '../actions';
import { friendlyActionError } from '../action-errors';

type VerifyMethod = 'dns' | 'file';
type ServerDomain = { domain: string; status: string; token: string | null; expiresAt: string | null };

/**
 * Domain confirmation — intentionally the LAST wizard step (step 8 of 9).
 * It is OPTIONAL during creation (you may skip it and come back later), but
 * publishing requires a verified AND admin-approved domain (see
 * checkPublishReadiness). After the technical DNS/file check passes, the
 * domain enters status='awaiting_approval' and a supervisor (مشرف) or admin
 * must approve it from /admin/verification before it becomes 'verified'.
 */
export function StepVerification({ errors }: { errors: string[] }): React.JSX.Element {
  const { data, updateVerification } = useWizardStore();
  const v = data.verification;
  const [method, setMethod] = React.useState<VerifyMethod>('dns');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<boolean | null>(null);
  const [serverDomains, setServerDomains] = React.useState<ServerDomain[]>([]);
  const hydratedRef = React.useRef(false);

  // Hydrate from the backend: a verified domain (company_domains,
  // status=verified) shows "موثّق" immediately; a technically-checked domain
  // awaiting admin approval (status=awaiting_approval) shows the review badge.
  // If the domain is empty, prefill the company's most recent row.
  React.useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    (async () => {
      const res = await getVerifiedDomainsAction();
      if (!res.ok || !res.domains) return;
      setServerDomains(res.domains);
      const verifiedRows = res.domains.filter((d) => d.status === 'verified' && d.token);
      const pendingRows = res.domains.filter((d) => d.status === 'awaiting_approval' && d.token);
      const cur = useWizardStore.getState().data.verification;
      const vMatch = verifiedRows.find((d) => d.domain === cur.domain);
      if (vMatch) {
        updateVerification({
          verified: true,
          token: vMatch.token ?? cur.token,
          sentence: vMatch.token ? `masrbounty-verification=${vMatch.token}` : cur.sentence,
        });
        return;
      }
      const pMatch = pendingRows.find((d) => d.domain === cur.domain);
      if (pMatch) {
        updateVerification({
          verified: false,
          token: pMatch.token ?? cur.token,
          sentence: pMatch.token ? `masrbounty-verification=${pMatch.token}` : cur.sentence,
        });
        return;
      }
      if (!cur.domain) {
        const first = verifiedRows[0] ?? pendingRows[0];
        if (first) {
          updateVerification({
            domain: first.domain,
            verified: first.status === 'verified',
            token: first.token ?? '',
            sentence: first.token ? `masrbounty-verification=${first.token}` : '',
          });
        }
      }
    })();
  }, [updateVerification]);

  const domainValid = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v.domain.trim());

  // Auto-generate token/sentence when domain changes and not yet verified.
  // Returns true on success, or the specific Arabic error string on failure.
  const ensureToken = React.useCallback(async (): Promise<true | string> => {
    const domain = v.domain.trim().toLowerCase();
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      return 'أدخل دومينًا بصيغة صحيحة (مثال: example.com)';
    }
    if (v.token) return true;
    const res = await createVerificationTokenAction(domain);
    if (res.ok) {
      updateVerification({ token: res.token, sentence: res.sentence });
      return true;
    }
    return res.error;
  }, [v.domain, v.token, updateVerification]);

  async function onGenerate() {
    setBusy(true);
    setMsg(null);
    setOk(null);
    try {
      const got = await ensureToken();
      if (got !== true) {
        setOk(false);
        setMsg(got);
      }
    } catch (e) {
      setOk(false);
      setMsg(friendlyActionError(e));
    }
    setBusy(false);
  }

  async function onVerify() {
    setBusy(true);
    setMsg(null);
    setOk(null);
    try {
      if (method === 'dns') {
        const res = await verifyDomainTxtAction(v.domain, v.token);
        if (res.verified) {
          updateVerification({ verified: false });
          setOk(true);
          setMsg(`نجح الفحص التقني عبر سجل DNS${res.host ? ` (${res.host})` : ''} ✓ — أُرسل الطلب لموافقة مشرف أو أدمن المنصة، وسيعتمد التوثيق بعد مراجعتهم`);
        } else {
          setOk(false);
          setMsg(res.error ?? 'لم يتم العثور على سجل TXT — تأكد من المضيف والقيمة وأعد المحاولة');
        }
      } else {
        const res = await verifyDomainFileAction(v.domain, v.token);
        if (res.verified) {
          updateVerification({ verified: false });
          setOk(true);
          setMsg('نجح الفحص التقني للملف ✓ — أُرسل الطلب لموافقة مشرف أو أدمن المنصة، وسيعتمد التوثيق بعد مراجعتهم');
        } else {
          setOk(false);
          setMsg(res.error ?? 'الملف غير موجود أو الجملة غير مطابقة — تأكد من المسار والمحتوى');
        }
      }
    } catch (e) {
      setOk(false);
      setMsg(friendlyActionError(e));
    } finally {
      setBusy(false);
    }
  }

  // Server status for the CURRENT domain — drives the review-state badge.
  const currentServerStatus =
    serverDomains.find((s) => s.domain === v.domain.trim().toLowerCase())?.status ?? null;
  const awaitingApproval = !v.verified && currentServerStatus === 'awaiting_approval';

  const fileUrl = v.domain && v.token ? `https://${v.domain}/${v.token}.txt` : '';
  const sentence = v.sentence || (v.token ? `masrbounty-verification=${v.token}` : '');
  const txtHost = v.domain ? `_masrbounty.${v.domain}` : '_masrbounty.example.com';

  function copy(text: string, label: string): void {
    void navigator.clipboard.writeText(text);
    setOk(null);
    setMsg(`تم نسخ ${label}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black">تأكيد الدومين — آخر اختيار قبل النشر</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          هذه الخطوة اختيارية أثناء الإنشاء — يمكنك تخطيها وإكمالها لاحقًا، لكن النشر يتطلب دومين موثق ومعتمد من الإدارة. بعد نجاح الفحص التقني يراجع الطلب مشرف أو مدير المنصة قبل اعتماد التوثيق نهائيًا.
        </p>
      </div>

      {errors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive">{errors.join(' • ')}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />خطوة التحقق</CardTitle>
          <CardDescription>أدخل دومين شركتك، ثم أضف سجل TXT بالإعدادات الظاهرة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="v-domain">الدومين *</Label>
            <Input
              id="v-domain"
              dir="ltr"
              placeholder="example.com"
              value={v.domain}
              onChange={(e) => {
                const d = e.target.value.trim().toLowerCase();
                // Keep the verified badge while the domain still matches a
                // server-verified row — only a real change un-verifies.
                const stillVerified = serverDomains.some((s) => s.status === 'verified' && s.domain === d && s.token);
                updateVerification({ domain: d, verified: stillVerified });
              }}
              onBlur={ensureToken}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">بدون https — مثال: <code dir="ltr">example.com</code></p>
          </div>

          {v.domain && (
            <>
              {/* method toggle — DNS TXT is the primary method */}
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="طريقة التحقق">
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === 'dns'}
                  onClick={() => { setMethod('dns'); setMsg(null); setOk(null); }}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${method === 'dns' ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent'}`}
                >
                  <Globe className="h-4 w-4" />
                  سجل DNS (TXT) — موصى بها
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === 'file'}
                  onClick={() => { setMethod('file'); setMsg(null); setOk(null); }}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${method === 'file' ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent'}`}
                >
                  ملف على الموقع (بديل)
                </button>
              </div>

              {method === 'dns' ? (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="text-sm font-bold">١) أضف سجلًا جديدًا في لوحة تحكم DNS عند مزوّد الدومين:</p>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2 rounded-md bg-background border px-3 py-2" dir="ltr">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Type</span>
                      <span className="font-mono">TXT</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy('TXT', 'النوع')} aria-label="نسخ النوع">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2 rounded-md bg-background border px-3 py-2" dir="ltr">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Host / Name</span>
                      <span className="font-mono break-all">{txtHost}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(txtHost, 'اسم المضيف')} aria-label="نسخ اسم المضيف">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2 rounded-md bg-slate-950 text-amber-300 border border-slate-800 px-3 py-2" dir="ltr">
                      <span className="text-xs font-bold uppercase opacity-80">Value</span>
                      <span className="font-mono break-all">{sentence || 'masrbounty-verification=— سيظهر بعد إنشاء الرمز —'}</span>
                      {sentence && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-amber-300 hover:text-amber-200 hover:bg-white/10" onClick={() => copy(sentence, 'القيمة')} aria-label="نسخ القيمة">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-[90px_1fr] items-center gap-2 rounded-md bg-background border px-3 py-2" dir="ltr">
                      <span className="text-xs font-bold text-muted-foreground uppercase">TTL</span>
                      <span className="font-mono">Auto (أو 3600)</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    بعض لوحات التحكم تطلب Host فقط بدون الدومين — اكتب <code dir="ltr">_masrbounty</code>. القيمة تُضاف كما هي بدون علامات تنصيص.
                  </p>
                  <p className="text-xs text-amber-600">
                    ملاحظة: انتشار DNS قد يستغرق من دقائق إلى 48 ساعة حسب المزوّد — لو فشل التحقق انتظر قليلًا وأعد المحاولة.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="text-sm font-bold">١) أنشئ هذا الملف على موقعك — في الجذر مباشرة، باسم الرمز نفسه:</p>
                  <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-2 text-sm font-mono" dir="ltr">
                    <span className="flex-1 truncate">{fileUrl || 'https://example.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.txt'}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copy(fileUrl, 'المسار')}
                      aria-label="نسخ المسار"
                      disabled={!fileUrl}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {fileUrl && (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    الملف مطلوب في الجذر باسم الرمز (مثال: <code dir="ltr">hazem.blog/xxxxxxxx.txt</code>) — ويُقبل أيضًا المسار البديل <code dir="ltr">/.well-known/masrbounty-verification.txt</code>.
                  </p>

                  <p className="text-sm font-bold pt-2">٢) محتوى الملف — جملة واحدة بالضبط:</p>
                  <div className="flex items-center gap-2 rounded-md bg-slate-950 text-amber-300 border border-slate-800 px-3 py-3 text-sm font-mono" dir="ltr">
                    <span className="flex-1 break-all">{sentence || 'masrbounty-verification=— سيظهر بعد إدخال الدومين —'}</span>
                    {sentence && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-amber-300 hover:text-amber-200 hover:bg-white/10"
                        onClick={() => copy(sentence, 'الجملة')}
                        aria-label="نسخ الجملة"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">الملف يجب أن يكون نصًا عاديًا (text/plain) ويحتوي الجملة كما هي — بدون HTML.</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {!v.token ? (
                  <Button type="button" onClick={onGenerate} disabled={busy || !domainValid} className="gap-2">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    إنشاء رمز التحقق
                  </Button>
                ) : (
                  <Button type="button" onClick={onVerify} disabled={busy} className="gap-2">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : ok === false ? <RefreshCw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {method === 'dns'
                      ? ok === false
                        ? 'إعادة فحص سجل DNS'
                        : 'تحقق من سجل DNS'
                      : ok === false
                        ? 'إعادة الفحص'
                        : 'تحقق الآن'}
                  </Button>
                )}
                {v.verified ? (
                  <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" /> موثّق
                  </Badge>
                ) : awaitingApproval ? (
                  <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-500">
                    <ShieldCheck className="h-3.5 w-3.5" /> تم الفحص — بانتظار موافقة الإدارة
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> بانتظار التحقق
                  </Badge>
                )}
                {!v.verified && serverDomains.some((s) => s.status === 'verified') && (
                  <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300">
                    <BadgeCheck className="h-3.5 w-3.5" /> لديك دومينات موثقة في حسابك
                  </Badge>
                )}
                {msg && <span className={`text-sm ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>{msg}</span>}
              </div>
              {!v.token && !domainValid && (
                <p className="text-xs text-amber-600">أدخل دومينًا بصيغة صحيحة (مثال: example.com) لتفعيل إنشاء الرمز.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        بعد نجاح الفحص التقني يُرسل الطلب تلقائيًا لموافقة مشرف أو أدمن المنصة، ويصلك إشعار عند الاعتماد — يمكنك المتابعة إلى خطوة النشر والنشر لن يكتمل إلا بعد الاعتماد. {method === 'dns' ? 'سجل TXT يبقى للمراجعة الدورية — لا تحذفه.' : 'الملف يبقى للمراجعة الدورية — لا تحذفه.'}
      </p>
    </div>
  );
}
