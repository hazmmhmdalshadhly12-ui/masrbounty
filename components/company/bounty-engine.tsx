'use client';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Coins, Shield } from 'lucide-react';

type SeverityCode = 'informational' | 'low' | 'medium' | 'high' | 'critical';

interface SeverityPolicy {
  code: SeverityCode;
  label_ar: string;
  label_en: string;
  min_bounty: number;
  max_bounty: number;
  reputation_points: number;
}

interface BountyPolicyRow {
  severity: SeverityCode;
  min_amount: number;
  max_amount: number;
}

interface AwardRow {
  id: string;
  report_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  created_at: string;
}

interface PaymentRow {
  id: string;
  award_id: string;
  amount: number;
  status: string;
  reference: string | null;
  created_at: string;
}

interface BountyEngineProps {
  reportId: string;
  programId?: string | null;
  initialSeverity?: SeverityCode | string;
  existingAward?: AwardRow | null;
}

const SEVERITY_AR: Record<SeverityCode, string> = {
  informational: 'معلوماتية',
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  critical: 'حرجة',
};

const SEVERITY_ORDER: SeverityCode[] = ['informational', 'low', 'medium', 'high', 'critical'];

const FALLBACK_POLICIES: SeverityPolicy[] = [
  { code: 'informational', label_ar: 'معلوماتية', label_en: 'Informational', min_bounty: 0, max_bounty: 0, reputation_points: 1 },
  { code: 'low', label_ar: 'منخفضة', label_en: 'Low', min_bounty: 25, max_bounty: 100, reputation_points: 5 },
  { code: 'medium', label_ar: 'متوسطة', label_en: 'Medium', min_bounty: 100, max_bounty: 500, reputation_points: 10 },
  { code: 'high', label_ar: 'عالية', label_en: 'High', min_bounty: 500, max_bounty: 2000, reputation_points: 25 },
  { code: 'critical', label_ar: 'حرجة', label_en: 'Critical', min_bounty: 2000, max_bounty: 10000, reputation_points: 60 },
];

export function BountyEngine({ reportId, programId, initialSeverity, existingAward: initialAward }: BountyEngineProps) {
  const [severity, setSeverity] = useState<SeverityCode>((initialSeverity as SeverityCode) ?? 'medium');
  const [amount, setAmount] = useState<string>('');
  const [policies, setPolicies] = useState<SeverityPolicy[]>(FALLBACK_POLICIES);
  const [programPolicies, setProgramPolicies] = useState<BountyPolicyRow[] | null>(null);
  const [award, setAward] = useState<AwardRow | null>(initialAward ?? null);
  const [proposed, setProposed] = useState<{ severity: SeverityCode; amount: number } | null>(null);
  const [reference, setReference] = useState('');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  // Load severity catalog + program policies + existing award if not provided
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: sev } = await supabase.from('report_severity').select('code,label_ar,label_en,min_bounty,max_bounty,reputation_points').order('min_bounty');
        if (alive && sev && sev.length) {
          setPolicies(sev as SeverityPolicy[]);
        }
        if (programId) {
          const { data: pp } = await supabase.from('bounty_policies').select('severity,min_amount,max_amount').eq('program_id', programId);
          if (alive && pp) setProgramPolicies(pp as BountyPolicyRow[]);
        }
        if (!initialAward) {
          const { data: aw } = await supabase.from('bounty_awards').select('id,report_id,amount,status,created_at').eq('report_id', reportId).maybeSingle();
          if (alive && aw) setAward(aw as AwardRow);
        }
        if (alive && initialAward?.id) {
          const { data: pays } = await supabase.from('bounty_payments').select('id,award_id,amount,status,reference,created_at').eq('award_id', initialAward.id).order('created_at', { ascending: false });
          if (pays) setPayments(pays as PaymentRow[]);
        } else if (alive && award?.id) {
          const { data: pays } = await supabase.from('bounty_payments').select('id,award_id,amount,status,reference,created_at').eq('award_id', award.id).order('created_at', { ascending: false });
          if (pays) setPayments(pays as PaymentRow[]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, programId]);

  // refresh payments when award changes
  useEffect(() => {
    if (!award?.id) return;
    (async () => {
      const { data: pays } = await supabase.from('bounty_payments').select('id,award_id,amount,status,reference,created_at').eq('award_id', award.id).order('created_at', { ascending: false });
      if (pays) setPayments(pays as PaymentRow[]);
    })();
  }, [award?.id, supabase]);

  const activePolicy = (() => {
    const prog = programPolicies?.find((p) => p.severity === severity);
    if (prog) return { min: Number(prog.min_amount), max: Number(prog.max_amount) };
    const cat = policies.find((p) => p.code === severity);
    if (cat) return { min: Number(cat.min_bounty), max: Number(cat.max_bounty) };
    return { min: 0, max: 10000 };
  })();

  const duplicateBlocked = !!award && ['approved', 'paid'].includes(award.status);
  const numericAmount = Number(amount);

  function handlePropose() {
    setError(null);
    setSuccess(null);
    if (duplicateBlocked) {
      setError('تم منح مكافأة لهذا التقرير مسبقًا — لا يمكن التكرار (Duplicate prevention).');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError('المبلغ غير صالح');
      return;
    }
    if (numericAmount < activePolicy.min || numericAmount > activePolicy.max) {
      setError(`المبلغ يجب أن يكون بين ${activePolicy.min} و ${activePolicy.max} EGP للخطورة ${SEVERITY_AR[severity]}`);
      return;
    }
    setProposed({ severity, amount: numericAmount });
    setSuccess(`تم اقتراح مكافأة ${numericAmount} EGP للخطورة ${SEVERITY_AR[severity]} — بانتظار الموافقة`);
  }

  function handleApprove() {
    if (!proposed) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const { data: awardId, error: rpcError } = await supabase.rpc('award_bounty', { p_report: reportId, p_amount: proposed.amount });
        if (rpcError) {
          const msg = rpcError.message ?? '';
          if (/already awarded|already paid/i.test(msg)) {
            setError('تمت معالجة المكافأة مسبقًا — منع التكرار مفعل');
          } else if (/forbidden/i.test(msg)) {
            setError('غير مصرّح لك بهذه العملية');
          } else {
            setError(msg || 'فشل منح المكافأة');
          }
          return;
        }
        if (awardId) {
          const { data: aw } = await supabase.from('bounty_awards').select('id,report_id,amount,status,created_at').eq('id', awardId as string).single();
          if (aw) setAward(aw as AwardRow);
          else setAward({ id: awardId as string, report_id: reportId, amount: proposed.amount, status: 'approved', created_at: new Date().toISOString() });
        }
        setSuccess('تمت الموافقة — المكافأة معتمدة وبانتظار الدفع');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل الموافقة');
      }
    });
  }

  function handlePay() {
    if (!award) return;
    const ref = reference.trim().slice(0, 120);
    if (!ref) {
      setError('مرجع الدفع مطلوب');
      return;
    }
    if (award.status === 'paid') {
      setError('المكافأة مدفوعة بالفعل');
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const { error: rpcError } = await supabase.rpc('pay_award', { p_award: award.id, p_reference: ref });
        if (rpcError) {
          const msg = rpcError.message ?? '';
          if (/already paid/i.test(msg)) setError('المكافأة مدفوعة مسبقًا');
          else if (/reference required/i.test(msg)) setError('مرجع الدفع مطلوب');
          else setError(msg || 'فشل الدفع');
          return;
        }
        const { data: updated } = await supabase.from('bounty_awards').select('id,report_id,amount,status,created_at').eq('id', award.id).single();
        if (updated) setAward(updated as AwardRow);
        else setAward({ ...award, status: 'paid' });
        const { data: pays } = await supabase.from('bounty_payments').select('id,award_id,amount,status,reference,created_at').eq('award_id', award.id).order('created_at', { ascending: false });
        if (pays) setPayments(pays as PaymentRow[]);
        setSuccess(`تم الدفع — مرجع: ${ref}. تم إنشاء سجل العملية (Transaction)`);
        setReference('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل الدفع');
      }
    });
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Severity → Bounty Mapping UI */}
      <Card className="dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            خريطة الخطورة → المكافأة
          </CardTitle>
          <CardDescription>حدود المكافأة حسب الخطورة — داكن/فاتح آمن</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-right">
                  <th className="px-3 py-2 font-medium">الخطورة</th>
                  <th className="px-3 py-2 font-medium">الحد الأدنى</th>
                  <th className="px-3 py-2 font-medium">الحد الأقصى</th>
                  <th className="px-3 py-2 font-medium">نقاط السمعة</th>
                  <th className="px-3 py-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {SEVERITY_ORDER.map((code) => {
                  const cat = policies.find((p) => p.code === code) ?? FALLBACK_POLICIES.find((p) => p.code === code)!;
                  const prog = programPolicies?.find((p) => p.severity === code);
                  const min = prog ? Number(prog.min_amount) : Number(cat.min_bounty);
                  const max = prog ? Number(prog.max_amount) : Number(cat.max_bounty);
                  const isActive = severity === code;
                  return (
                    <tr key={code} className={`border-t transition-colors ${isActive ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-muted/40'}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => setSeverity(code)} className={`rounded-full px-2.5 py-1 text-xs font-bold ${isActive ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-muted text-muted-foreground'}`}>
                          {cat.label_ar} ({code})
                        </button>
                      </td>
                      <td className="px-3 py-2 tabular-nums" dir="ltr">{min.toLocaleString()} EGP</td>
                      <td className="px-3 py-2 tabular-nums" dir="ltr">{max.toLocaleString()} EGP</td>
                      <td className="px-3 py-2 tabular-nums">{cat.reputation_points}</td>
                      <td className="px-3 py-2">{isActive ? <Badge>محدد</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {programPolicies && (
            <p className="mt-2 text-xs text-muted-foreground">سياسة البرنامج مخصصة — تُطبق حدود البرنامج بدل الكتالوج العام عند وجودها.</p>
          )}
        </CardContent>
      </Card>

      {/* Award Flow */}
      <Card className="dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-amber-600" />
            تدفق المكافأة: اقتراح → موافقة → دفع → سجل العملية
          </CardTitle>
          <CardDescription>مربوط بـ RPCs: award_bounty / pay_award مع منع التكرار</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {duplicateBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">منع التكرار مفعل</p>
                <p className="mt-1 text-xs">يوجد مكافأة بحالة <b>{award?.status}</b> بقيمة <b dir="ltr">{Number(award?.amount).toLocaleString()} EGP</b> — لا يمكن اقتراح/منح مكافأة ثانية لنفس التقرير (UNIQUE report_id).</p>
              </div>
            </div>
          )}

          {/* Step 1: Propose */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-bold text-muted-foreground">١. اقتراح المكافأة (severity + amount)</p>
            <div className="flex flex-wrap gap-2">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as SeverityCode)} className="h-10 rounded-md border bg-background px-3 text-sm" disabled={duplicateBlocked}>
                {SEVERITY_ORDER.map((c) => (
                  <option key={c} value={c}>{SEVERITY_AR[c]} ({c})</option>
                ))}
              </select>
              <Input type="number" min={activePolicy.min} max={activePolicy.max} placeholder={`المبلغ (${activePolicy.min}–${activePolicy.max})`} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 w-40" dir="ltr" disabled={duplicateBlocked} />
              <Button onClick={handlePropose} disabled={duplicateBlocked || !amount} variant="secondary">
                اقتراح
              </Button>
              {proposed && <Badge variant="secondary" className="self-center">{proposed.severity} — {proposed.amount} EGP</Badge>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">الحد المسموح: {activePolicy.min}–{activePolicy.max} EGP للخطورة المختارة.</p>
          </div>

          {/* Step 2: Approve */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-bold text-muted-foreground">٢. الموافقة</p>
            {!proposed ? (
              <p className="text-sm text-muted-foreground">اقترح مكافأة أولًا.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">مقترح: <b dir="ltr">{proposed.amount} EGP</b> ({SEVERITY_AR[proposed.severity]})</span>
                <Button onClick={handleApprove} disabled={isPending || duplicateBlocked} size="sm">
                  {isPending ? 'جارٍ...' : 'موافقة وتنفيذ award_bounty'}
                </Button>
                {award && <Badge>{award.status}</Badge>}
              </div>
            )}
            {award && !proposed && (
              <p className="mt-2 text-sm">حالة حالية: <Badge>{award.status}</Badge> <span dir="ltr" className="tabular-nums">{Number(award.amount).toLocaleString()} EGP</span></p>
            )}
          </div>

          {/* Step 3: Pay */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-bold text-muted-foreground">٣. الدفع + المعاملة</p>
            {!award || award.status === 'paid' ? (
              award?.status === 'paid' ? (
                <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> مدفوعة — انظر سجل المعاملات أدناه</p>
              ) : (
                <p className="text-sm text-muted-foreground">بانتظار الموافقة قبل الدفع.</p>
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                <Input placeholder="مرجع التحويل (reference)" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className="h-9 w-56" dir="ltr" />
                <Button onClick={handlePay} disabled={isPending || !reference.trim()} size="sm">
                  {isPending ? 'جارٍ...' : 'دفع pay_award'}
                </Button>
                <span className="self-center text-xs text-muted-foreground">ينشئ سجل في bounty_payments + wallet_transactions</span>
              </div>
            )}
          </div>

          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</div>}
          {success && <div className="rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">{success}</div>}

          {/* Transaction log */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-bold text-muted-foreground">٤. سجل المعاملات (Wallet / Payments)</p>
            {!payments.length ? (
              <p className="text-sm text-muted-foreground">لا توجد معاملات بعد — تظهر هنا بعد الدفع.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-2 text-sm">
                    <span dir="ltr" className="tabular-nums">{Number(p.amount).toLocaleString()} EGP — {p.status}</span>
                    {p.reference && <span className="font-mono text-xs text-muted-foreground" dir="ltr">ref: {p.reference}</span>}
                    <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
