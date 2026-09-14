import { Clock, PiggyBank, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface WalletBalance {
  balance?: number | null;
  pending_balance?: number | null;
  total_earned?: number | null;
}

interface BalanceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  wallet?: WalletBalance;
  title?: string;
}

export function BalanceCard({ wallet, title = 'رصيد المحفظة', className, ...props }: BalanceCardProps) {
  const stats = [
    { label: 'الرصيد المتاح', value: Number(wallet?.balance ?? 0), Icon: Wallet, accent: true },
    { label: 'الرصيد المعلق', value: Number(wallet?.pending_balance ?? 0), Icon: Clock, accent: false },
    { label: 'إجمالي المكتسب', value: Number(wallet?.total_earned ?? 0), Icon: PiggyBank, accent: false },
  ];
  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)} aria-label={title} {...props}>
      {stats.map(({ label, value, Icon, accent }) => (
        <Card key={label} className={accent ? 'border-slate-900 dark:border-slate-100' : ''}>
          <CardContent className="p-4">
            <span className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="mt-2 block text-2xl font-black tabular-nums" dir="ltr">
              {value.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">EGP</span>
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
