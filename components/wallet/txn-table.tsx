import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/time';

export interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  note?: string | null;
  created_at: string;
}

const typeAr: Record<string, string> = {
  bounty: 'مكافأة',
  payout: 'سحب',
  refund: 'استرداد',
  adjustment: 'تسوية',
};

interface TxnTableProps extends React.HTMLAttributes<HTMLDivElement> {
  transactions?: WalletTxn[];
  title?: string;
}

export function TxnTable({ transactions = [], title = 'سجل المعاملات', className, ...props }: TxnTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-card-foreground', className)} {...props}>
      {title && <h3 className="border-b px-4 py-3 text-sm font-bold">{title}</h3>}
      {!transactions.length ? (
        <p className="p-6 text-center text-sm text-muted-foreground">لا معاملات بعد — المكافآت والسحوبات ستظهر هنا.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">النوع</th>
                <th className="px-4 py-2.5 font-medium">المبلغ</th>
                <th className="px-4 py-2.5 font-medium">البيان</th>
                <th className="px-4 py-2.5 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                        t.type === 'bounty' && 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                        t.type === 'payout' && 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                        t.type === 'refund' && 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                        !['bounty', 'payout', 'refund'].includes(t.type) && 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {typeAr[t.type] ?? t.type}
                    </span>
                  </td>
                  <td
                    className={cn('px-4 py-2.5 font-bold tabular-nums', Number(t.amount) < 0 ? 'text-red-600' : 'text-green-700')}
                    dir="ltr"
                  >
                    {Number(t.amount) > 0 ? '+' : ''}
                    {Number(t.amount).toLocaleString()}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground">{t.note ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
