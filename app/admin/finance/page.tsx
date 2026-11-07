import { requireSession } from '@/lib/auth/guard';
import { createServerClient } from '@/lib/supabase/server';
import { FinanceDashboard } from '@/components/admin/finance-dashboard';
import type {
  BountyReward, CommissionHistory, CommissionSetting, CompanyWalletV2,
  WalletDepositRequest, WalletTransactionV2,
} from '@/types/wallet';

export const dynamic = 'force-dynamic';

interface PayoutRow {
  id: string;
  reward_id: string;
  amount_minor: number;
  status: string;
  failure_reason: string | null;
  payment_reference: string | null;
  created_at: string;
  researcher_profiles: { display_name: string } | null;
  company_profiles: { name: string } | null;
}

export default async function AdminFinancePage() {
  // Smart finance is admin-only (moderators get a clean 403).
  await requireSession({ roles: ['admin'], next: '/admin/finance' });

  const supabase = await createServerClient();
  const [{ data: wallets }, { data: payouts }, { data: deposits }, { data: txns }, { data: revenueRows }, { data: commission }, { data: history }, { data: rewards }] =
    await Promise.all([
      supabase.from('company_wallets').select('*, company_profiles(name)').order('updated_at', { ascending: false }).limit(200),
      supabase
        .from('researcher_payouts')
        .select('*, researcher_profiles(display_name), company_profiles(name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('wallet_deposit_requests')
        .select('*, company_profiles(name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('wallet_transactions_v2')
        .select('*, company_wallets(company_id, company_profiles(name))')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('financial_ledger_entries').select('amount_minor').eq('account_key', 'platform_revenue').eq('entry_type', 'credit'),
      supabase.from('commission_settings').select('*, company_profiles(name)').order('updated_at', { ascending: false }),
      supabase.from('commission_history').select('*').order('changed_at', { ascending: false }).limit(15),
      supabase.from('bounty_rewards').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

  const walletRows = (wallets ?? []) as unknown as Array<CompanyWalletV2 & { company_profiles: { name: string } | null }>;
  const payoutRows = (payouts ?? []) as unknown as PayoutRow[];
  const depositRows = (deposits ?? []) as unknown as Array<WalletDepositRequest & { company_profiles: { name: string } | null }>;
  const txnRows = (txns ?? []) as unknown as Array<WalletTransactionV2 & { company_wallets: { company_profiles: { name: string } | null } | null }>;
  const commissionRows = (commission ?? []) as unknown as Array<CommissionSetting & { company_profiles: { name: string } | null }>;
  const historyRows = (history ?? []) as unknown as CommissionHistory[];
  const rewardRows = (rewards ?? []) as unknown as BountyReward[];

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const metrics = {
    depositsTotalMinor: sum(walletRows.map((w) => w.total_deposits_minor ?? 0)),
    availableMinor: sum(walletRows.map((w) => w.available_balance_minor ?? 0)),
    reservedMinor: sum(walletRows.map((w) => w.reserved_balance_minor ?? 0)),
    feesMinor: sum(walletRows.map((w) => w.total_fees_minor ?? 0)),
    rewardsPaidMinor: sum(walletRows.map((w) => w.total_rewards_minor ?? 0)),
    payoutsAwaiting: payoutRows.filter((p) => p.status === 'awaiting_payout').length,
    payoutsAwaitingMinor: sum(payoutRows.filter((p) => p.status === 'awaiting_payout').map((p) => p.amount_minor)),
    payoutsProcessing: payoutRows.filter((p) => p.status === 'processing').length,
    payoutsFailed: payoutRows.filter((p) => p.status === 'failed' || p.status === 'cancelled').length,
    depositsPending: depositRows.filter((d) => d.status === 'pending').length,
    ledgerRevenueMinor: sum((revenueRows ?? []).map((r) => (r as { amount_minor: number }).amount_minor)),
    rewardsActive: rewardRows.filter((r) => r.status !== 'paid' && r.status !== 'cancelled').length,
  };

  return (
    <div className="container space-y-6 py-8">
      <FinanceDashboard
        metrics={metrics}
        wallets={walletRows.map((w) => ({
          company_id: w.company_id,
          company_name: w.company_profiles?.name ?? w.company_id.slice(0, 8),
          available_minor: w.available_balance_minor,
          reserved_minor: w.reserved_balance_minor,
          deposits_minor: w.total_deposits_minor,
          rewards_minor: w.total_rewards_minor,
          fees_minor: w.total_fees_minor,
        }))}
        payouts={payoutRows.map((p) => ({
          id: p.id,
          reward_id: p.reward_id,
          researcher: p.researcher_profiles?.display_name ?? '—',
          company: p.company_profiles?.name ?? '—',
          amount_minor: p.amount_minor,
          status: p.status,
          failure_reason: p.failure_reason,
          payment_reference: p.payment_reference,
          created_at: p.created_at,
        }))}
        deposits={depositRows.map((d) => ({
          id: d.id,
          company: d.company_profiles?.name ?? '—',
          amount_minor: d.amount_minor,
          method: d.method,
          reference: d.reference,
          proof_url: d.proof_url,
          status: d.status,
          created_at: d.created_at,
        }))}
        txns={txnRows.map((t) => ({
          id: t.id,
          company: t.company_wallets?.company_profiles?.name ?? '—',
          type: t.type,
          direction: t.direction,
          amount_minor: t.amount_minor,
          available_after_minor: t.available_after_minor,
          reserved_after_minor: t.reserved_after_minor,
          created_at: t.created_at,
        }))}
        commission={{
          global: commissionRows.find((c) => c.scope === 'global' && c.is_active) ?? null,
          overrides: commissionRows
            .filter((c) => c.scope === 'company')
            .map((c) => ({
              company_id: c.company_id ?? '',
              company_name: c.company_profiles?.name ?? (c.company_id ?? '').slice(0, 8),
              rate_bp: c.rate_bp,
              is_active: c.is_active,
            })),
        }}
        history={historyRows.map((h) => ({
          id: h.id,
          scope: h.scope,
          company_id: h.company_id,
          old_rate_bp: h.old_rate_bp,
          new_rate_bp: h.new_rate_bp,
          is_active: h.is_active,
          reason: h.reason,
          changed_at: h.changed_at,
        }))}
      />
    </div>
  );
}
