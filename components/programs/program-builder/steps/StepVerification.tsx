'use client';
import * as React from 'react';
import { useWizardStore } from '../store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Copy, ExternalLink, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { createVerificationTokenAction, verifyDomainFileAction } from '../actions';

export function StepVerification({ errors }: { errors: string[] }): React.JSX.Element {
  const { data, updateVerification } = useWizardStore();
  const v = data.verification;
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<boolean | null>(null);

  // Auto-generate token/sentence when domain changes and not yet verified
  const ensureToken = React.useCallback(async () => {
    const domain = v.domain.trim().toLowerCase();
    if (!domain || v.token) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return;
    const res = await createVerificationTokenAction(domain);
    if (res?.token && res?.sentence) {
      updateVerification({ token: res.token, sentence: res.sentence });
    }
  }, [v.domain, v.token, updateVerification]);

  async function onVerify() {
    setBusy(true);
    setMsg(null);
    setOk(null);
    try {
      const res = await verifyDomainFileAction(v.domain, v.token);
      if (res.verified) {
        updateVerification({ verified: true });
        setOk(true);
        setMsg('تم التحقق بنجاح — ملكية الدومين مؤكدة ✓');
      } else {
        setOk(false);
        setMsg(res.error ?? 'الملف غير موجود أو الجملة غير مطابقة — تأكد من المسار والمحتوى');
      }
    } catch (e) {
      setOk(false);
      setMsg(e instanceof Error ? e.message : 'فشل التحقق');
    } finally {
      setBusy(false);
    }
  }

  const fileUrl = v.domain ? `https://${v.domain}${v.filePath}` : '';
  const sentence = v.sentence || (v.token ? `masrbounty-verification=${v.token}` : '');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black">إثبات ملكية الدومين</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          ضع ملفًا نصيًا في موقعك يحتوي جملة التحقق — سنقرأه للتحقق من ملكيتك (بدون DNS).
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
          <CardDescription>أدخل دومين شركتك، ثم أنشئ الملف بالمكان المحدد</CardDescription>
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
                updateVerification({ domain: d, verified: false });
              }}
              onBlur={ensureToken}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">بدون https — مثال: <code dir="ltr">example.com</code></p>
          </div>

          {v.domain && (
            <>
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-bold">١) أنشئ هذا الملف على موقعك:</p>
                <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-2 text-sm font-mono" dir="ltr">
                  <span className="flex-1 truncate">{fileUrl || `https://example.com${v.filePath}`}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => navigator.clipboard.writeText(fileUrl)}
                    aria-label="نسخ المسار"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <p className="text-sm font-bold pt-2">٢) محتوى الملف — جملة واحدة بالضبط:</p>
                <div className="flex items-center gap-2 rounded-md bg-slate-950 text-amber-300 border border-slate-800 px-3 py-3 text-sm font-mono" dir="ltr">
                  <span className="flex-1 break-all">{sentence || 'masrbounty-verification=— سيظهر بعد إدخال الدومين —'}</span>
                  {sentence && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-amber-300 hover:text-amber-200 hover:bg-white/10"
                      onClick={() => navigator.clipboard.writeText(sentence)}
                      aria-label="نسخ الجملة"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">الملف يجب أن يكون نصًا عاديًا (text/plain) ويحتوي الجملة كما هي — بدون HTML.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={onVerify} disabled={busy || !v.token || !v.domain} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  تحقق الآن
                </Button>
                {v.verified ? (
                  <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" /> موثّق
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> بانتظار التحقق
                  </Badge>
                )}
                {msg && <span className={`text-sm ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>{msg}</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        بعد التحقق بنجاح يمكنك المتابعة. الملف يبقى للمراجعة الدورية — لا تحذفه.
      </p>
    </div>
  );
}
