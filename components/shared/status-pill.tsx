import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  triaged: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  informative: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  duplicate: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  not_applicable: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  resolved: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  closed: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  completed: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  open: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

const severityStyles: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  high: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  informational: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const ar: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مُقدّم',
  triaged: 'قيد الفرز',
  informative: 'معلوماتي',
  duplicate: 'مكرر',
  not_applicable: 'غير منطبق',
  accepted: 'مقبول',
  resolved: 'محلول',
  closed: 'مغلق',
  critical: 'حرجة',
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
  informational: 'معلوماتية',
  active: 'نشط',
  paused: 'موقوف',
  pending: 'معلق',
  approved: 'معتمد',
  rejected: 'مرفوض',
  completed: 'مكتمل',
  failed: 'فاشل',
  open: 'مفتوح',
  public: 'عام',
  private: 'خاص',
};

export function StatusPill({ value, kind = 'status' }: { value: string; kind?: 'status' | 'severity' }) {
  const styles = kind === 'severity' ? severityStyles : statusStyles;
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
        styles[value] ?? 'bg-slate-100 text-slate-600'
      )}
    >
      {ar[value] ?? value}
    </span>
  );
}
