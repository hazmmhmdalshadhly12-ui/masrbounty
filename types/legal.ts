import type { LedgerEntryType } from '@/types/wallet';

export type LegalCategory = 'core' | 'bounty' | 'company' | 'researcher' | 'data';
export type LegalVersionStatus = 'draft' | 'published' | 'superseded';
export type LegalAcceptanceContext = 'registration' | 'reacceptance' | 'update';

export interface LegalDocument {
  id: string;
  slug: string;
  title_ar: string;
  description_ar: string | null;
  category: LegalCategory;
  current_version: number | null;
  status: 'draft' | 'published';
  requires_reacceptance: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LegalDocumentVersion {
  id: string;
  document_id: string;
  version: number;
  content_md: string;
  change_summary_ar: string | null;
  status: LegalVersionStatus;
  published_by: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LegalAcceptance {
  id: string;
  user_id: string;
  document_slug: string;
  version: number;
  context: LegalAcceptanceContext;
  age_confirmed: boolean;
  accepted_at: string;
}

/** Row returned by RPC get_required_legal_docs. */
export interface RequiredLegalDoc {
  slug: string;
  title_ar: string;
  accepted_version: number | null;
  current_version: number | null;
  requires_reacceptance: boolean;
}

/** Debit/credit pair builder result — sum(debit) must equal sum(credit). */
export interface LedgerSide {
  account_key: string;
  account_type: string;
  entity_id: string | null;
  entry_type: LedgerEntryType;
  amount_minor: number;
  description?: string;
}
