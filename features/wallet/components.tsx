'use client';

import type { PayoutRequest, Wallet, WalletTransaction } from './types';

export function WalletView({ wallet }: { wallet: Wallet | null }) {
  if (!wallet) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">No wallet yet</p>
        <p className="text-sm text-muted-foreground">Your earnings wallet will appear here.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Available</p>
        <p className="text-2xl font-bold">{wallet.balance}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Pending</p>
        <p className="text-2xl font-bold">{wallet.pending_balance}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Total earned</p>
        <p className="text-2xl font-bold">{wallet.total_earned}</p>
      </div>
    </div>
  );
}

export function TransactionList({ transactions }: { transactions: WalletTransaction[] }) {
  if (transactions.length === 0) return <p className="text-sm text-muted-foreground">No transactions yet.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between p-3 text-sm">
          <span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs">{t.type}</span> {t.note ?? ''}
          </span>
          <span className="font-medium">{t.amount}</span>
        </li>
      ))}
    </ul>
  );
}

export function PayoutList({ payouts }: { payouts: PayoutRequest[] }) {
  if (payouts.length === 0) return <p className="text-sm text-muted-foreground">No payout requests.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {payouts.map((p) => (
        <li key={p.id} className="flex items-center justify-between p-3 text-sm">
          <span className="font-medium">{p.amount}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{p.status}</span>
        </li>
      ))}
    </ul>
  );
}
