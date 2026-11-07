export type BountyStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
export type TxnType = 'bounty' | 'payout' | 'refund' | 'adjustment' | 'deposit';
export type DepositStatus = 'pending' | 'approved' | 'rejected';
export type DepositMethod = 'vodafone_cash' | 'instapay' | 'bank' | 'other';
export type PaymentMethodType = 'bank' | 'wallet' | 'vodafone_cash' | 'instapay' | 'other';

export interface Wallet {
  id: string;
  researcher_id: string;
  balance: number;
  pending_balance: number;
  total_earned: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: TxnType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** Legacy alias kept for backwards compatibility. */
export type Txn = WalletTransaction;

export interface CompanyWallet {
  id: string;
  company_id: string;
  balance: number;
  pending_balance: number;
  total_funded: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyWalletTransaction {
  id: string;
  company_wallet_id: string;
  type: TxnType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DepositRequest {
  id: string;
  company_id: string;
  amount: number;
  method: DepositMethod;
  sender_name: string | null;
  reference: string;
  note: string | null;
  status: DepositStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface BountyAward {
  id: string;
  report_id: string;
  amount: number;
  status: BountyStatus;
  awarded_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface BountyPayment {
  id: string;
  award_id: string;
  amount: number;
  status: PaymentStatus;
  reference: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutRequest {
  id: string;
  researcher_id: string;
  amount: number;
  status: PayoutStatus;
  payment_method_id: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  researcher_id: string;
  type: PaymentMethodType;
  label: string;
  details: Record<string, string | number | boolean | null>;
  is_default: boolean;
  created_at: string;
}

/** One ledger row in the unified admin money ledger. */
export interface LedgerEntry {
  id: string;
  side: 'researcher' | 'company';
  owner_label: string;
  type: TxnType;
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

/* ============================================================
 * SMART WALLET v2 — integer minor units (piastres), immutable
 * ledger. See supabase/migrations/24_smart_wallet_finance.sql
 * ============================================================ */

export type RewardState =
  | 'reward_approved'
  | 'awaiting_payout'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export type WalletTxnV2Type =
  | 'deposit'
  | 'bounty_hold'
  | 'bounty_release'
  | 'bounty_refund'
  | 'adjustment';

export type LedgerAccountType =
  | 'company_available'
  | 'company_reserved'
  | 'platform_revenue'
  | 'external';

export type LedgerEntryType = 'debit' | 'credit';

export interface CompanyWalletV2 extends CompanyWallet {
  available_balance_minor: number;
  reserved_balance_minor: number;
  total_deposits_minor: number;
  total_rewards_minor: number;
  total_fees_minor: number;
  currency: string;
}

export interface WalletDepositRequest {
  id: string;
  company_id: string;
  amount_minor: number;
  currency: string;
  method: DepositMethod;
  reference: string;
  sender_name: string | null;
  proof_url: string | null;
  note: string | null;
  status: DepositStatus;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransactionV2 {
  id: string;
  wallet_id: string;
  type: WalletTxnV2Type;
  direction: 'in' | 'out';
  amount_minor: number;
  available_after_minor: number;
  reserved_after_minor: number;
  reference_type: string | null;
  reference_id: string | null;
  idempotency_key: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FinancialLedgerEntry {
  id: string;
  transaction_id: string;
  account_key: string;
  account_type: LedgerAccountType;
  entity_id: string | null;
  entry_type: LedgerEntryType;
  amount_minor: number;
  currency: string;
  description: string | null;
  created_at: string;
}

/** Commission rate locked at approval time. */
export interface BountyReward {
  id: string;
  report_id: string;
  program_id: string;
  company_id: string;
  researcher_id: string;
  reward_amount_minor: number;
  commission_rate_bp: number;
  commission_amount_minor: number;
  total_charged_minor: number;
  currency: string;
  status: RewardState;
  approved_by: string | null;
  approved_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearcherPayout {
  id: string;
  reward_id: string;
  researcher_id: string;
  company_id: string;
  amount_minor: number;
  currency: string;
  status: RewardState;
  proof_url: string | null;
  payment_reference: string | null;
  failure_reason: string | null;
  processed_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionSetting {
  id: string;
  scope: 'global' | 'company';
  company_id: string | null;
  rate_bp: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionHistory {
  id: string;
  setting_id: string | null;
  scope: 'global' | 'company';
  company_id: string | null;
  old_rate_bp: number | null;
  new_rate_bp: number;
  is_active: boolean;
  reason: string;
  changed_by: string | null;
  changed_at: string;
}

export interface FinancialApproval {
  id: string;
  entity_type: 'deposit_request' | 'payout' | 'adjustment' | 'reward' | 'commission';
  entity_id: string;
  approver_id: string | null;
  action: 'approved' | 'rejected' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'retry';
  note: string | null;
  created_at: string;
}

export interface FinancialAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/** Server-computed preview shown to the company BEFORE confirming a reward. */
export interface RewardPreview {
  rate_bp: number;
  rate_percent: string;
  reward_minor: number;
  commission_minor: number;
  total_minor: number;
  available_minor: number;
  sufficient: boolean;
}
