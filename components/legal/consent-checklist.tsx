'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REGISTRATION_CHECKS, REACCEPTANCE_CHECKS } from '@/constants/legal';
import { acceptLegalAgreementAction } from '@/features/legal/acceptance-actions';

type Mode = 'registration' | 'reacceptance';

/**
 * The mandatory Legal & Security Agreement checklist.
 * The submit button stays disabled until ALL five checkboxes are ticked —
 * there is no way to complete the stage without explicit consent, and the
 * server re-validates every flag + document versions anyway.
 */
export function ConsentChecklist({
  mode = 'registration',
  nextUrl,
}: {
  mode?: Mode;
  nextUrl?: string;
}) {
  const checks = mode === 'registration' ? REGISTRATION_CHECKS : REACCEPTANCE_CHECKS;
  const [state, setState] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checks.every((c) => state[c.id] === true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChecked || busy) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      for (const c of checks) fd.set(c.id, state[c.id] ? 'on' : 'off');
      fd.set('context', mode === 'registration' ? 'registration' : 'reacceptance');
      const res = await acceptLegalAgreementAction(fd);
      if (!res.ok) {
        setError(res.error ?? 'تعذر حفظ الموافقة — حاول لاحقًا');
        return;
      }
      const target = nextUrl && nextUrl.startsWith('/') ? nextUrl : '/dashboard';
      window.location.assign(target);
    } catch {
      setError('تعذر حفظ الموافقة حاليًا — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {checks.map((c) => {
          const checked = state[c.id] === true;
          return (
            <li key={c.id}>
              <label
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 text-sm leading-relaxed transition-colors duration-150',
                  checked
                    ? 'border-emerald-500 bg-emerald-50/60 dark:border-emerald-600/60 dark:bg-emerald-950/30'
                    : 'border-border hover:border-slate-400 dark:hover:border-slate-500',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setState((s) => ({ ...s, [c.id]: e.target.checked }))}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-emerald-600"
                  aria-label={c.label}
                  required
                />
                <span className="flex-1">
                  <span className="font-bold">{c.label}</span>
                  {c.linkSlug && (
                    <>
                      {' '}
                      <Link
                        href={`/legal/${c.linkSlug}`}
                        target="_blank"
                        className="inline-flex items-center gap-0.5 font-bold text-primary underline underline-offset-4"
                      >
                        قراءة الوثيقة
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </>
                  )}
                </span>
                {checked && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />}
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        type="submit"
        disabled={!allChecked || busy}
        className="h-12 w-full text-base"
        aria-disabled={!allChecked}
      >
        {busy ? (
          <>
            <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جارٍ الحفظ…
          </>
        ) : (
          <>
            <ShieldCheck className="ml-2 h-5 w-5" />
            {mode === 'registration' ? 'أوافق وأكمل التسجيل' : 'أوافق وأكمل'}
          </>
        )}
      </Button>
      {!allChecked && (
        <p className="text-center text-xs text-muted-foreground">
          لا يمكن إكمال التسجيل قبل الموافقة على جميع البنود الخمسة.
        </p>
      )}
    </form>
  );
}
