import { AlertTriangle } from 'lucide-react';
import { LEGAL_WARNING_AR } from '@/constants/legal';

/** Rendered on every legal page + the consent gate: the platform never
 *  presents its policies as lawyer-reviewed legal advice. */
export function LegalWarningBanner() {
  return (
    <div
      role="note"
      aria-label="تنبيه قانوني"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{LEGAL_WARNING_AR}</span>
    </div>
  );
}
