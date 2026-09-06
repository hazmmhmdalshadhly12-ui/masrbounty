-- ============================================================
-- MasrBounty - Complete Database Schema (Single File)
-- Supabase PostgreSQL | Run in SQL Editor
-- Order: Extensions > Types > Tables > Indexes > Functions > Triggers > Views > RLS > Policies > Storage > Seed
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. TYPES (ENUMS)
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('researcher','company','moderator','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE company_member_role AS ENUM ('owner','admin','triager','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE program_status AS ENUM ('draft','pending_review','active','paused','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE program_visibility AS ENUM ('public','private'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_type AS ENUM ('web','api','mobile','network','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('draft','submitted','triaged','informative','duplicate','not_applicable','accepted','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE severity_level AS ENUM ('informational','low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bounty_status AS ENUM ('pending','approved','rejected','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending','processing','completed','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payout_status AS ENUM ('pending','approved','rejected','processing','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE txn_type AS ENUM ('bounty','payout','refund','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dispute_status AS ENUM ('open','under_review','resolved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('open','in_progress','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('report','comment','bounty','payment','program','message','system','dispute','badge'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE audit_action AS ENUM ('create','update','delete','login','logout','award','payout','moderate','verify'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. TABLES (in dependency order)
-- 3.1 profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  locale TEXT DEFAULT 'ar' CHECK (locale IN ('ar','en')),
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.2 user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'researcher',
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);
-- 3.3 researcher_profiles
CREATE TABLE IF NOT EXISTS public.researcher_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  country TEXT DEFAULT 'EG',
  website TEXT,
  github TEXT,
  twitter TEXT,
  linkedin TEXT,
  skills TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.4 company_profiles
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  description TEXT,
  logo_url TEXT,
  website TEXT,
  country TEXT DEFAULT 'EG',
  is_verified BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.5 company_members
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role company_member_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES public.profiles(id),
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(company_id, user_id)
);
-- 3.6 company_invitations
CREATE TABLE IF NOT EXISTS public.company_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role company_member_role NOT NULL DEFAULT 'viewer',
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.7 company_verifications
CREATE TABLE IF NOT EXISTS public.company_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  document_url TEXT,
  status verification_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.8 programs
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  logo_url TEXT,
  visibility program_visibility NOT NULL DEFAULT 'public',
  status program_status NOT NULL DEFAULT 'draft',
  scope TEXT NOT NULL,
  out_of_scope TEXT,
  safe_harbor TEXT,
  contact_email TEXT,
  response_sla_hours INT DEFAULT 72 CHECK (response_sla_hours > 0),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.9 program_assets
CREATE TABLE IF NOT EXISTS public.program_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  type asset_type NOT NULL DEFAULT 'web',
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.10 program_rules
CREATE TABLE IF NOT EXISTS public.program_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.11 program_researchers (private invites)
CREATE TABLE IF NOT EXISTS public.program_researchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(program_id, researcher_id)
);
-- 3.12 saved_programs
CREATE TABLE IF NOT EXISTS public.saved_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(researcher_id, program_id)
);
-- 3.13 researcher_program_activity
CREATE TABLE IF NOT EXISTS public.researcher_program_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ DEFAULT now(),
  reports_count INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(researcher_id, program_id)
);
-- 3.14 reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_number TEXT UNIQUE NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.program_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  summary TEXT NOT NULL,
  vulnerability_type TEXT NOT NULL,
  severity severity_level NOT NULL DEFAULT 'medium',
  affected_asset TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT NOT NULL,
  reproduction_steps TEXT NOT NULL,
  remediation TEXT,
  status report_status NOT NULL DEFAULT 'draft',
  bounty_amount NUMERIC(12,2) DEFAULT 0 CHECK (bounty_amount >= 0),
  cvss_score NUMERIC(3,1) CHECK (cvss_score IS NULL OR (cvss_score >= 0 AND cvss_score <= 10)),
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.15 report_events
CREATE TABLE IF NOT EXISTS public.report_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_status report_status,
  to_status report_status,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.16 report_comments
CREATE TABLE IF NOT EXISTS public.report_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  is_internal BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.17 report_attachments
CREATE TABLE IF NOT EXISTS public.report_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.18 report_labels
CREATE TABLE IF NOT EXISTS public.report_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#64748b' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.19 report_label_links
CREATE TABLE IF NOT EXISTS public.report_label_links (
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.report_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (report_id, label_id)
);
-- 3.20 report_duplicates
CREATE TABLE IF NOT EXISTS public.report_duplicates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  duplicate_of UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  marked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CHECK (report_id <> duplicate_of)
);
-- 3.21 report_assignees
CREATE TABLE IF NOT EXISTS public.report_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(report_id, user_id)
);
-- 3.22 report_severity (severity policy catalog)
CREATE TABLE IF NOT EXISTS public.report_severity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code severity_level UNIQUE NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  min_bounty NUMERIC(12,2) DEFAULT 0 NOT NULL,
  max_bounty NUMERIC(12,2) DEFAULT 0 NOT NULL,
  reputation_points INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.23 bounty_policies
CREATE TABLE IF NOT EXISTS public.bounty_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  severity severity_level NOT NULL,
  min_amount NUMERIC(12,2) NOT NULL CHECK (min_amount >= 0),
  max_amount NUMERIC(12,2) NOT NULL CHECK (max_amount >= min_amount),
  UNIQUE(program_id, severity)
);
-- 3.24 bounty_awards
CREATE TABLE IF NOT EXISTS public.bounty_awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL UNIQUE REFERENCES public.reports(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status bounty_status NOT NULL DEFAULT 'pending',
  awarded_by UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.25 bounty_payments
CREATE TABLE IF NOT EXISTS public.bounty_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  award_id UUID NOT NULL REFERENCES public.bounty_awards(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status payment_status NOT NULL DEFAULT 'pending',
  reference TEXT,
  processed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.26 wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL UNIQUE REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (balance >= 0),
  pending_balance NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (pending_balance >= 0),
  total_earned NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (total_earned >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.27 wallet_transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type txn_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  balance_after NUMERIC(12,2) NOT NULL,
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.28 payout_requests
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status payout_status NOT NULL DEFAULT 'pending',
  payment_method_id UUID,
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.29 payment_methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bank','wallet','vodafone_cash','instapay','other')),
  label TEXT NOT NULL,
  details JSONB DEFAULT '{}' NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payout_method') THEN
    ALTER TABLE public.payout_requests ADD CONSTRAINT fk_payout_method FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;
  END IF;
END $$;
-- 3.30 disputes
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES public.profiles(id),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.31 dispute_messages
CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.32 conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.33 conversation_members
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(conversation_id, user_id)
);
-- 3.34 messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.35 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.36 notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_reports BOOLEAN DEFAULT true NOT NULL,
  email_bounty BOOLEAN DEFAULT true NOT NULL,
  email_messages BOOLEAN DEFAULT true NOT NULL,
  email_program BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.37 researcher_reputation
CREATE TABLE IF NOT EXISTS public.researcher_reputation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL UNIQUE REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  score INT DEFAULT 0 NOT NULL,
  rank INT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.38 researcher_stats
CREATE TABLE IF NOT EXISTS public.researcher_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL UNIQUE REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  total_reports INT DEFAULT 0 NOT NULL,
  accepted_reports INT DEFAULT 0 NOT NULL,
  resolved_reports INT DEFAULT 0 NOT NULL,
  duplicate_reports INT DEFAULT 0 NOT NULL,
  critical_count INT DEFAULT 0 NOT NULL,
  high_count INT DEFAULT 0 NOT NULL,
  medium_count INT DEFAULT 0 NOT NULL,
  low_count INT DEFAULT 0 NOT NULL,
  total_earned NUMERIC(12,2) DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.39 badges
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.40 researcher_badges
CREATE TABLE IF NOT EXISTS public.researcher_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(researcher_id, badge_id)
);
-- 3.41 achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.42 leaderboard_snapshots
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period TEXT NOT NULL CHECK (period IN ('global','monthly')),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  score INT NOT NULL,
  rank INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.43 hall_of_fame
CREATE TABLE IF NOT EXISTS public.hall_of_fame (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company_profiles(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  achievement TEXT NOT NULL,
  display_name TEXT NOT NULL,
  recognized_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.44 api_keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.45 audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.46 security_events
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.47 moderation_actions
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moderator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.48 support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.49 support_messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 3.50 platform_settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reports_program ON public.reports(program_id);
CREATE INDEX IF NOT EXISTS idx_reports_researcher ON public.reports(researcher_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON public.reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_number ON public.reports(report_number);
CREATE INDEX IF NOT EXISTS idx_reports_title_trgm ON public.reports USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_programs_company ON public.programs(company_id);
CREATE INDEX IF NOT EXISTS idx_programs_status ON public.programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_slug ON public.programs(slug);
CREATE INDEX IF NOT EXISTS idx_programs_name_trgm ON public.programs USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_report ON public.report_comments(report_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_report ON public.report_events(report_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_researcher ON public.wallets(researcher_id);
CREATE INDEX IF NOT EXISTS idx_txn_wallet ON public.wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_score ON public.researcher_reputation(score DESC);
CREATE INDEX IF NOT EXISTS idx_hof_date ON public.hall_of_fame(recognized_at DESC);
CREATE SEQUENCE IF NOT EXISTS report_number_seq START 1;

-- 5. FUNCTIONS
CREATE OR REPLACE FUNCTION public.generate_report_number() RETURNS TEXT AS $$
DECLARE n BIGINT; BEGIN n := nextval('report_number_seq'); RETURN 'MB-' || lpad(n::TEXT, 6, '0'); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.log_report_event() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.report_events(report_id, actor_id, from_status, to_status, note)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, 'Status changed');
    IF NEW.status = 'submitted' AND NEW.submitted_at IS NULL THEN NEW.submitted_at = now(); END IF;
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN NEW.resolved_at = now(); END IF;
  END IF; RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.ensure_researcher_defaults() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets(researcher_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.researcher_reputation(researcher_id, score) VALUES (NEW.id, 0) ON CONFLICT DO NOTHING;
  INSERT INTO public.researcher_stats(researcher_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.notification_preferences(user_id) VALUES (NEW.user_id) ON CONFLICT DO NOTHING;
  RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.refresh_researcher_stats(p_researcher UUID) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.researcher_stats(researcher_id) VALUES (p_researcher) ON CONFLICT (researcher_id) DO NOTHING;
  UPDATE public.researcher_stats s SET
    total_reports = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.status <> 'draft'),
    accepted_reports = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.status IN ('accepted','resolved','closed')),
    resolved_reports = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.status = 'resolved'),
    duplicate_reports = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.status = 'duplicate'),
    critical_count = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.severity='critical' AND r.status NOT IN ('draft','not_applicable')),
    high_count = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.severity='high' AND r.status NOT IN ('draft','not_applicable')),
    medium_count = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.severity='medium' AND r.status NOT IN ('draft','not_applicable')),
    low_count = (SELECT count(*) FROM public.reports r WHERE r.researcher_id = p_researcher AND r.severity='low' AND r.status NOT IN ('draft','not_applicable')),
    total_earned = COALESCE((SELECT sum(a.amount) FROM public.bounty_awards a JOIN public.reports r ON r.id=a.report_id WHERE r.researcher_id=p_researcher AND a.status IN ('approved','paid')),0),
    updated_at = now()
  WHERE s.researcher_id = p_researcher;
  UPDATE public.researcher_reputation SET score = (
    COALESCE((SELECT accepted_reports*10 + resolved_reports*20 + critical_count*50 + high_count*20 FROM public.researcher_stats WHERE researcher_id=p_researcher),0)
  ), updated_at = now() WHERE researcher_id = p_researcher;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.trg_refresh_stats() RETURNS TRIGGER AS $$
DECLARE v_researcher UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_researcher := OLD.researcher_id; ELSE v_researcher := NEW.researcher_id; END IF;
  PERFORM public.refresh_researcher_stats(v_researcher);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.is_company_member(p_company UUID, p_user UUID) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS(SELECT 1 FROM public.company_members WHERE company_id=p_company AND user_id=p_user); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.has_role(p_role TEXT) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::TEXT=p_role); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.audit_insert() RETURNS TRIGGER AS $$
BEGIN INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata) VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW)); RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
-- Default report number from sequence (safe, prevents duplicates)
ALTER TABLE public.reports ALTER COLUMN report_number SET DEFAULT public.generate_report_number();

-- 6. TRIGGERS
DROP TRIGGER IF EXISTS trg_touch_profiles ON public.profiles; CREATE TRIGGER trg_touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_researcher ON public.researcher_profiles; CREATE TRIGGER trg_touch_researcher BEFORE UPDATE ON public.researcher_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_company ON public.company_profiles; CREATE TRIGGER trg_touch_company BEFORE UPDATE ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_programs ON public.programs; CREATE TRIGGER trg_touch_programs BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_reports ON public.reports; CREATE TRIGGER trg_touch_reports BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_report_status ON public.reports; CREATE TRIGGER trg_report_status BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.log_report_event();
DROP TRIGGER IF EXISTS trg_report_stats ON public.reports; CREATE TRIGGER trg_report_stats AFTER INSERT OR UPDATE OR DELETE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_stats();
DROP TRIGGER IF EXISTS trg_researcher_defaults ON public.researcher_profiles; CREATE TRIGGER trg_researcher_defaults AFTER INSERT ON public.researcher_profiles FOR EACH ROW EXECUTE FUNCTION public.ensure_researcher_defaults();
DROP TRIGGER IF EXISTS trg_touch_comments ON public.report_comments; CREATE TRIGGER trg_touch_comments BEFORE UPDATE ON public.report_comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_conv ON public.conversations; CREATE TRIGGER trg_touch_conv BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. VIEWS
-- security_invoker: views respect the caller's RLS (otherwise they leak across companies)
CREATE OR REPLACE VIEW public.researcher_leaderboard WITH (security_invoker = true) AS
SELECT rp.id AS researcher_id, rp.display_name, p.avatar_url, COALESCE(rep.score,0) AS score,
  COALESCE(s.accepted_reports,0) AS accepted_reports, COALESCE(s.resolved_reports,0) AS resolved_reports,
  COALESCE(s.total_earned,0) AS total_earned,
  RANK() OVER (ORDER BY COALESCE(rep.score,0) DESC) AS rank
FROM public.researcher_profiles rp JOIN public.profiles p ON p.id=rp.user_id
LEFT JOIN public.researcher_reputation rep ON rep.researcher_id=rp.id
LEFT JOIN public.researcher_stats s ON s.researcher_id=rp.id
WHERE rp.is_public = true ORDER BY score DESC;
CREATE OR REPLACE VIEW public.program_stats_view WITH (security_invoker = true) AS
SELECT pr.id AS program_id, pr.name, pr.slug, pr.status,
  count(r.id) AS total_reports,
  count(r.id) FILTER (WHERE r.status='submitted') AS new_reports,
  count(r.id) FILTER (WHERE r.status='resolved') AS resolved_reports,
  COALESCE(sum(r.bounty_amount),0) AS total_bounty
FROM public.programs pr LEFT JOIN public.reports r ON r.program_id=pr.id GROUP BY pr.id, pr.name, pr.slug, pr.status;
CREATE OR REPLACE VIEW public.report_overview WITH (security_invoker = true) AS
SELECT r.id, r.report_number, r.title, r.status, r.severity, r.bounty_amount, r.created_at,
  pr.name AS program_name, pr.slug AS program_slug, cp.name AS company_name,
  rp.display_name AS researcher_name
FROM public.reports r JOIN public.programs pr ON pr.id=r.program_id
JOIN public.company_profiles cp ON cp.id=pr.company_id
JOIN public.researcher_profiles rp ON rp.id=r.researcher_id;

-- 8. RLS ENABLE
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researcher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_researchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researcher_program_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_label_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_severity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researcher_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researcher_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researcher_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_of_fame ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 9. POLICIES (core, secure defaults)
-- profiles: public read, own update
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles; CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles; CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles; CREATE POLICY "profiles_own_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- user_roles: admin read, service manage (no direct user write)
DROP POLICY IF EXISTS "roles_admin_read" ON public.user_roles; CREATE POLICY "roles_admin_read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "roles_self_insert" ON public.user_roles; CREATE POLICY "roles_self_insert" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id AND role IN ('researcher', 'company'));
-- researcher_profiles: public read if is_public, own write
DROP POLICY IF EXISTS "rp_public_read" ON public.researcher_profiles; CREATE POLICY "rp_public_read" ON public.researcher_profiles FOR SELECT USING (is_public = true OR user_id = auth.uid() OR public.has_role('admin'));
DROP POLICY IF EXISTS "rp_own_insert" ON public.researcher_profiles; CREATE POLICY "rp_own_insert" ON public.researcher_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "rp_own_update" ON public.researcher_profiles; CREATE POLICY "rp_own_update" ON public.researcher_profiles FOR UPDATE USING (user_id = auth.uid());
-- company_profiles: public read, owner update
DROP POLICY IF EXISTS "cp_public_read" ON public.company_profiles; CREATE POLICY "cp_public_read" ON public.company_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "cp_owner_insert" ON public.company_profiles; CREATE POLICY "cp_owner_insert" ON public.company_profiles FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "cp_member_update" ON public.company_profiles; CREATE POLICY "cp_member_update" ON public.company_profiles FOR UPDATE USING (owner_id = auth.uid() OR public.is_company_member(id, auth.uid()) OR public.has_role('admin'));
-- company_members: members + admin read
DROP POLICY IF EXISTS "cm_read" ON public.company_members; CREATE POLICY "cm_read" ON public.company_members FOR SELECT USING (user_id = auth.uid() OR public.is_company_member(company_id, auth.uid()) OR public.has_role('admin'));
DROP POLICY IF EXISTS "cm_manage" ON public.company_members; CREATE POLICY "cm_manage" ON public.company_members FOR ALL USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid())) WITH CHECK (true);
-- programs: public active read, company manage
DROP POLICY IF EXISTS "prog_public_read" ON public.programs; CREATE POLICY "prog_public_read" ON public.programs FOR SELECT USING (public.can_view_program(id, auth.uid()));
DROP POLICY IF EXISTS "prog_company_write" ON public.programs; CREATE POLICY "prog_company_write" ON public.programs FOR ALL USING (public.is_company_member(company_id, auth.uid()) OR created_by=auth.uid() OR public.has_role('admin')) WITH CHECK (true);
-- program_assets/rules/policies: same as program visibility
DROP POLICY IF EXISTS "pa_read" ON public.program_assets; CREATE POLICY "pa_read" ON public.program_assets FOR SELECT USING (public.can_view_program(program_id, auth.uid()));
DROP POLICY IF EXISTS "pa_write" ON public.program_assets; CREATE POLICY "pa_write" ON public.program_assets FOR ALL USING (EXISTS(SELECT 1 FROM public.programs p WHERE p.id=program_id AND (public.is_company_member(p.company_id, auth.uid()) OR public.has_role('admin')))) WITH CHECK (true);
DROP POLICY IF EXISTS "pr_rules_read" ON public.program_rules; CREATE POLICY "pr_rules_read" ON public.program_rules FOR SELECT USING (public.can_view_program(program_id, auth.uid()));
DROP POLICY IF EXISTS "pr_rules_write" ON public.program_rules; CREATE POLICY "pr_rules_write" ON public.program_rules FOR ALL USING (EXISTS(SELECT 1 FROM public.programs p WHERE p.id=program_id AND (public.is_company_member(p.company_id, auth.uid()) OR public.has_role('admin')))) WITH CHECK (true);
DROP POLICY IF EXISTS "bp_read" ON public.bounty_policies; CREATE POLICY "bp_read" ON public.bounty_policies FOR SELECT USING (public.can_view_program(program_id, auth.uid()));
DROP POLICY IF EXISTS "bp_write" ON public.bounty_policies; CREATE POLICY "bp_write" ON public.bounty_policies FOR ALL USING (EXISTS(SELECT 1 FROM public.programs p WHERE p.id=program_id AND (public.is_company_member(p.company_id, auth.uid()) OR public.has_role('admin')))) WITH CHECK (true);
-- reports: researcher own, company own programs, admin all
DROP POLICY IF EXISTS "rep_select" ON public.reports; CREATE POLICY "rep_select" ON public.reports FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id=program_id AND public.is_company_member(p.company_id, auth.uid()))
  OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "rep_insert" ON public.reports; CREATE POLICY "rep_insert" ON public.reports FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid()));
DROP POLICY IF EXISTS "rep_update" ON public.reports; CREATE POLICY "rep_update" ON public.reports FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id=program_id AND public.is_company_member(p.company_id, auth.uid()))
  OR public.has_role('admin') OR public.has_role('moderator'));
-- report_comments: participants
DROP POLICY IF EXISTS "rc_select" ON public.report_comments; CREATE POLICY "rc_select" ON public.report_comments FOR SELECT USING (EXISTS(SELECT 1 FROM public.reports r WHERE r.id=report_id AND (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=r.researcher_id AND rp.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id=r.program_id AND public.is_company_member(p.company_id, auth.uid())) OR public.has_role('admin') OR public.has_role('moderator'))));
DROP POLICY IF EXISTS "rc_insert" ON public.report_comments; CREATE POLICY "rc_insert" ON public.report_comments FOR INSERT WITH CHECK (author_id = auth.uid());
-- report_attachments: same as reports, uploader only insert
DROP POLICY IF EXISTS "ra_select" ON public.report_attachments; CREATE POLICY "ra_select" ON public.report_attachments FOR SELECT USING (EXISTS(SELECT 1 FROM public.reports r WHERE r.id=report_id AND (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=r.researcher_id AND rp.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id=r.program_id AND public.is_company_member(p.company_id, auth.uid())) OR public.has_role('admin'))));
DROP POLICY IF EXISTS "ra_insert" ON public.report_attachments; CREATE POLICY "ra_insert" ON public.report_attachments FOR INSERT WITH CHECK (uploaded_by = auth.uid());
-- report_events: read via report access
DROP POLICY IF EXISTS "re_select" ON public.report_events; CREATE POLICY "re_select" ON public.report_events FOR SELECT USING (EXISTS(SELECT 1 FROM public.reports r WHERE r.id=report_id AND (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=r.researcher_id AND rp.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id=r.program_id AND public.is_company_member(p.company_id, auth.uid())) OR public.has_role('admin') OR public.has_role('moderator'))));
-- labels: public read
DROP POLICY IF EXISTS "rl_read" ON public.report_labels; CREATE POLICY "rl_read" ON public.report_labels FOR SELECT USING (true);
DROP POLICY IF EXISTS "rl_admin_write" ON public.report_labels; CREATE POLICY "rl_admin_write" ON public.report_labels FOR ALL USING (public.has_role('admin') OR public.has_role('moderator')) WITH CHECK (true);
DROP POLICY IF EXISTS "rll_read" ON public.report_label_links; CREATE POLICY "rll_read" ON public.report_label_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "rll_write" ON public.report_label_links; CREATE POLICY "rll_write" ON public.report_label_links FOR ALL USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.reports r JOIN public.programs p ON p.id=r.program_id WHERE r.id=report_id AND public.is_company_member(p.company_id, auth.uid()))) WITH CHECK (true);
DROP POLICY IF EXISTS "rd_read" ON public.report_duplicates; CREATE POLICY "rd_read" ON public.report_duplicates FOR SELECT USING (true);
DROP POLICY IF EXISTS "rd_write" ON public.report_duplicates; CREATE POLICY "rd_write" ON public.report_duplicates FOR ALL USING (public.has_role('admin') OR public.has_role('moderator') OR EXISTS(SELECT 1 FROM public.reports r JOIN public.programs p ON p.id=r.program_id WHERE r.id=report_id AND public.is_company_member(p.company_id, auth.uid()))) WITH CHECK (true);
DROP POLICY IF EXISTS "ras_read" ON public.report_assignees; CREATE POLICY "ras_read" ON public.report_assignees FOR SELECT USING (true);
DROP POLICY IF EXISTS "ras_write" ON public.report_assignees; CREATE POLICY "ras_write" ON public.report_assignees FOR ALL USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.reports r JOIN public.programs p ON p.id=r.program_id WHERE r.id=report_id AND public.is_company_member(p.company_id, auth.uid()))) WITH CHECK (true);
DROP POLICY IF EXISTS "rs_read" ON public.report_severity; CREATE POLICY "rs_read" ON public.report_severity FOR SELECT USING (true);
-- wallets: owner + admin
DROP POLICY IF EXISTS "w_select" ON public.wallets; CREATE POLICY "w_select" ON public.wallets FOR SELECT USING (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid()) OR public.has_role('admin'));
-- wallet_transactions: via wallet
DROP POLICY IF EXISTS "wt_select" ON public.wallet_transactions; CREATE POLICY "wt_select" ON public.wallet_transactions FOR SELECT USING (EXISTS(SELECT 1 FROM public.wallets w JOIN public.researcher_profiles rp ON rp.id=w.researcher_id WHERE w.id=wallet_id AND (rp.user_id=auth.uid() OR public.has_role('admin'))));
-- bounty_awards/payments: via report access + admin
DROP POLICY IF EXISTS "ba_select" ON public.bounty_awards; CREATE POLICY "ba_select" ON public.bounty_awards FOR SELECT USING (EXISTS(SELECT 1 FROM public.reports r WHERE r.id=report_id AND (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=r.researcher_id AND rp.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id=r.program_id AND public.is_company_member(p.company_id, auth.uid())) OR public.has_role('admin'))));
DROP POLICY IF EXISTS "ba_write" ON public.bounty_awards; CREATE POLICY "ba_write" ON public.bounty_awards FOR ALL USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.reports r JOIN public.programs p ON p.id=r.program_id WHERE r.id=report_id AND public.is_company_member(p.company_id, auth.uid()))) WITH CHECK (true);
DROP POLICY IF EXISTS "bpay_select" ON public.bounty_payments; CREATE POLICY "bpay_select" ON public.bounty_payments FOR SELECT USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.bounty_awards a JOIN public.reports r ON r.id=a.report_id JOIN public.programs p ON p.id=r.program_id WHERE a.id=award_id AND public.is_company_member(p.company_id, auth.uid())));
DROP POLICY IF EXISTS "bpay_write" ON public.bounty_payments; CREATE POLICY "bpay_write" ON public.bounty_payments FOR ALL USING (public.has_role('admin')) WITH CHECK (true);
-- payouts/methods: owner
DROP POLICY IF EXISTS "pr_select" ON public.payout_requests; CREATE POLICY "pr_select" ON public.payout_requests FOR SELECT USING (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid()) OR public.has_role('admin'));
DROP POLICY IF EXISTS "pr_insert" ON public.payout_requests; CREATE POLICY "pr_insert" ON public.payout_requests FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid()));
DROP POLICY IF EXISTS "pr_admin_update" ON public.payout_requests; CREATE POLICY "pr_admin_update" ON public.payout_requests FOR UPDATE USING (public.has_role('admin'));
DROP POLICY IF EXISTS "pm_all" ON public.payment_methods; CREATE POLICY "pm_all" ON public.payment_methods FOR ALL USING (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid()));
-- messaging
DROP POLICY IF EXISTS "conv_select" ON public.conversations; CREATE POLICY "conv_select" ON public.conversations FOR SELECT USING (EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=id AND user_id=auth.uid()) OR public.has_role('admin'));
DROP POLICY IF EXISTS "conv_insert" ON public.conversations; CREATE POLICY "conv_insert" ON public.conversations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "cmem_select" ON public.conversation_members; CREATE POLICY "cmem_select" ON public.conversation_members FOR SELECT USING (user_id=auth.uid() OR public.has_role('admin'));
DROP POLICY IF EXISTS "cmem_insert" ON public.conversation_members; CREATE POLICY "cmem_insert" ON public.conversation_members FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "msg_select" ON public.messages; CREATE POLICY "msg_select" ON public.messages FOR SELECT USING (EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=messages.conversation_id AND user_id=auth.uid()) OR public.has_role('admin'));
DROP POLICY IF EXISTS "msg_insert" ON public.messages; CREATE POLICY "msg_insert" ON public.messages FOR INSERT WITH CHECK (sender_id=auth.uid() AND EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=messages.conversation_id AND user_id=auth.uid()));
-- notifications
DROP POLICY IF EXISTS "notif_all" ON public.notifications; CREATE POLICY "notif_all" ON public.notifications FOR ALL USING (user_id=auth.uid() OR public.has_role('admin')) WITH CHECK (user_id=auth.uid() OR public.has_role('admin'));
DROP POLICY IF EXISTS "notifpref_all" ON public.notification_preferences; CREATE POLICY "notifpref_all" ON public.notification_preferences FOR ALL USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
-- reputation/stats/badges: public read
DROP POLICY IF EXISTS "rep_read" ON public.researcher_reputation; CREATE POLICY "rep_read" ON public.researcher_reputation FOR SELECT USING (true);
DROP POLICY IF EXISTS "stats_read" ON public.researcher_stats; CREATE POLICY "stats_read" ON public.researcher_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "badge_read" ON public.badges; CREATE POLICY "badge_read" ON public.badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "rb_read" ON public.researcher_badges; CREATE POLICY "rb_read" ON public.researcher_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "rb_write" ON public.researcher_badges; CREATE POLICY "rb_write" ON public.researcher_badges FOR ALL USING (public.has_role('admin')) WITH CHECK (true);
DROP POLICY IF EXISTS "ach_read" ON public.achievements; CREATE POLICY "ach_read" ON public.achievements FOR SELECT USING (true);
DROP POLICY IF EXISTS "lb_read" ON public.leaderboard_snapshots; CREATE POLICY "lb_read" ON public.leaderboard_snapshots FOR SELECT USING (true);
DROP POLICY IF EXISTS "hof_read" ON public.hall_of_fame; CREATE POLICY "hof_read" ON public.hall_of_fame FOR SELECT USING (true);
DROP POLICY IF EXISTS "hof_write" ON public.hall_of_fame; CREATE POLICY "hof_write" ON public.hall_of_fame FOR ALL USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid())) WITH CHECK (true);
-- disputes
DROP POLICY IF EXISTS "disp_select" ON public.disputes; CREATE POLICY "disp_select" ON public.disputes FOR SELECT USING (opened_by=auth.uid() OR public.has_role('admin') OR public.has_role('moderator') OR EXISTS(SELECT 1 FROM public.reports r JOIN public.programs p ON p.id=r.program_id WHERE r.id=report_id AND public.is_company_member(p.company_id, auth.uid())));
DROP POLICY IF EXISTS "disp_insert" ON public.disputes; CREATE POLICY "disp_insert" ON public.disputes FOR INSERT WITH CHECK (opened_by=auth.uid());
DROP POLICY IF EXISTS "disp_update" ON public.disputes; CREATE POLICY "disp_update" ON public.disputes FOR UPDATE USING (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "dmsg_select" ON public.dispute_messages; CREATE POLICY "dmsg_select" ON public.dispute_messages FOR SELECT USING (EXISTS(SELECT 1 FROM public.disputes d WHERE d.id=dispute_id AND (d.opened_by=auth.uid() OR public.has_role('admin') OR public.has_role('moderator') OR EXISTS(SELECT 1 FROM public.reports r JOIN public.programs p ON p.id=r.program_id WHERE r.id=d.report_id AND public.is_company_member(p.company_id, auth.uid())))));
DROP POLICY IF EXISTS "dmsg_insert" ON public.dispute_messages; CREATE POLICY "dmsg_insert" ON public.dispute_messages FOR INSERT WITH CHECK (author_id=auth.uid());
-- saved/activity/program_researchers
DROP POLICY IF EXISTS "sp_all" ON public.saved_programs; CREATE POLICY "sp_all" ON public.saved_programs FOR ALL USING (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid()));
DROP POLICY IF EXISTS "rpa_read" ON public.researcher_program_activity; CREATE POLICY "rpa_read" ON public.researcher_program_activity FOR SELECT USING (true);
DROP POLICY IF EXISTS "prg_res_read" ON public.program_researchers; CREATE POLICY "prg_res_read" ON public.program_researchers FOR SELECT USING (true);
DROP POLICY IF EXISTS "prg_res_write" ON public.program_researchers; CREATE POLICY "prg_res_write" ON public.program_researchers FOR ALL USING (EXISTS(SELECT 1 FROM public.programs p WHERE p.id=program_id AND (public.is_company_member(p.company_id, auth.uid()) OR public.has_role('admin')))) WITH CHECK (true);
DROP POLICY IF EXISTS "prg_respond" ON public.program_researchers; CREATE POLICY "prg_respond" ON public.program_researchers FOR UPDATE USING (EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid())) WITH CHECK (status IN ('accepted','declined'));
-- admin tables
DROP POLICY IF EXISTS "audit_admin" ON public.audit_logs; CREATE POLICY "audit_admin" ON public.audit_logs FOR SELECT USING (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "sec_admin" ON public.security_events; CREATE POLICY "sec_admin" ON public.security_events FOR SELECT USING (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "mod_admin" ON public.moderation_actions; CREATE POLICY "mod_admin" ON public.moderation_actions FOR ALL USING (public.has_role('admin') OR public.has_role('moderator')) WITH CHECK (true);
DROP POLICY IF EXISTS "api_own" ON public.api_keys; CREATE POLICY "api_own" ON public.api_keys FOR ALL USING (user_id=auth.uid() OR public.has_role('admin')) WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS "sup_select" ON public.support_tickets; CREATE POLICY "sup_select" ON public.support_tickets FOR SELECT USING (user_id=auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "sup_insert" ON public.support_tickets; CREATE POLICY "sup_insert" ON public.support_tickets FOR INSERT WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS "supmsg_select" ON public.support_messages; CREATE POLICY "supmsg_select" ON public.support_messages FOR SELECT USING (EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND (t.user_id=auth.uid() OR public.has_role('admin') OR public.has_role('moderator'))));
DROP POLICY IF EXISTS "supmsg_insert" ON public.support_messages; CREATE POLICY "supmsg_insert" ON public.support_messages FOR INSERT WITH CHECK (author_id=auth.uid());
DROP POLICY IF EXISTS "inv_read" ON public.company_invitations; CREATE POLICY "inv_read" ON public.company_invitations FOR SELECT USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid()));
DROP POLICY IF EXISTS "inv_write" ON public.company_invitations; CREATE POLICY "inv_write" ON public.company_invitations FOR ALL USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid())) WITH CHECK (true);
DROP POLICY IF EXISTS "ver_read" ON public.company_verifications; CREATE POLICY "ver_read" ON public.company_verifications FOR SELECT USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid()));
DROP POLICY IF EXISTS "ver_write" ON public.company_verifications; CREATE POLICY "ver_write" ON public.company_verifications FOR ALL USING (public.has_role('admin') OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid())) WITH CHECK (true);
DROP POLICY IF EXISTS "pset_read" ON public.platform_settings; CREATE POLICY "pset_read" ON public.platform_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "pset_write" ON public.platform_settings; CREATE POLICY "pset_write" ON public.platform_settings FOR ALL USING (public.has_role('admin')) WITH CHECK (true);

-- 10. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true), ('company-logos','company-logos', true), ('report-attachments','report-attachments', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "avatars_public" ON storage.objects; CREATE POLICY "avatars_public" ON storage.objects FOR SELECT USING (bucket_id='avatars');
DROP POLICY IF EXISTS "avatars_upload" ON storage.objects; CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='avatars' AND auth.role()='authenticated');
DROP POLICY IF EXISTS "logos_public" ON storage.objects; CREATE POLICY "logos_public" ON storage.objects FOR SELECT USING (bucket_id='company-logos');
DROP POLICY IF EXISTS "logos_upload" ON storage.objects; CREATE POLICY "logos_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='company-logos' AND auth.role()='authenticated');
DROP POLICY IF EXISTS "attach_private" ON storage.objects; CREATE POLICY "attach_private" ON storage.objects FOR SELECT USING (
  bucket_id='report-attachments' AND auth.role()='authenticated' AND (
    public.has_role('admin') OR public.has_role('moderator') OR EXISTS(
      SELECT 1 FROM public.reports r
      LEFT JOIN public.researcher_profiles rp ON rp.id = r.researcher_id AND rp.user_id = auth.uid()
      LEFT JOIN public.programs p ON p.id = r.program_id
      LEFT JOIN public.company_members cm ON cm.company_id = p.company_id AND cm.user_id = auth.uid()
      WHERE r.id = ((storage.foldername(name))[1])::uuid AND (rp.id IS NOT NULL OR cm.user_id IS NOT NULL)
    )
  )
);
DROP POLICY IF EXISTS "attach_upload" ON storage.objects; CREATE POLICY "attach_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='report-attachments' AND auth.role()='authenticated');

-- 11. SEED (dev only, safe)
INSERT INTO public.platform_settings(key, value) VALUES ('site_name','"MasrBounty"'), ('maintenance_mode','false'), ('min_payout','{"amount": 50}'), ('platform_fee','{"percent": 10}'), ('vf_cash_number','"0112417443"') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.report_severity(code,label_ar,label_en,min_bounty,max_bounty,reputation_points) VALUES
 ('informational','معلوماتية','Informational',0,0,1), ('low','منخفضة','Low',25,100,5),
 ('medium','متوسطة','Medium',100,500,10), ('high','عالية','High',500,2000,25),
 ('critical','حرجة','Critical',2000,10000,60) ON CONFLICT (code) DO NOTHING;
INSERT INTO public.badges(code,name_ar,name_en,description_en,icon) VALUES
 ('first-blood','أول دم','First Blood','First accepted report','droplet'),
 ('critical-hunter','صائد الحرجة','Critical Hunter','Critical severity resolved','zap'),
 ('top-researcher','باحث متميز','Top Researcher','Top 10 leaderboard','trophy'),
 ('bug-hunter','صائد الثغرات','Bug Hunter','10 accepted reports','bug'),
 ('hall-of-fame','قاعة المشاهير','Hall of Fame','Recognized by company','award') ON CONFLICT (code) DO NOTHING;
INSERT INTO public.report_labels(name,color) VALUES ('xss','#ef4444'),('sqli','#f97316'),('idor','#8b5cf6'),('rce','#dc2626'),('csrf','#06b6d4') ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 12. VERIFICATION & TRUST EXTENSION (idempotent, re-runnable)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.researcher_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email','phone','identity')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(researcher_id, kind)
);
CREATE TABLE IF NOT EXISTS public.kyc_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  document_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('not_required','required','pending','verified','rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.domain_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed')),
  verified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(company_id, domain)
);
CREATE TABLE IF NOT EXISTS public.suspicious_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  detail TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID,
  reason TEXT NOT NULL CHECK (char_length(reason) >= 10),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.program_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  award_id UUID NOT NULL REFERENCES public.bounty_awards(id) ON DELETE CASCADE,
  gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
  fee_percent NUMERIC(5,2) NOT NULL CHECK (fee_percent >= 0 AND fee_percent <= 100),
  fee_amount NUMERIC(12,2) NOT NULL CHECK (fee_amount >= 0),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(award_id)
);
CREATE TABLE IF NOT EXISTS public.trust_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('researcher','company')),
  subject_id UUID NOT NULL,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  factors JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Live trust computation (no cron needed; always fresh)
CREATE OR REPLACE FUNCTION public.researcher_trust(p_researcher UUID)
RETURNS TABLE(score INT, factors JSONB) AS $$
DECLARE
  v_stats RECORD; v_age_days INT; v_verifs INT; v_viol INT;
  v_accept_rate NUMERIC; v_score INT;
BEGIN
  SELECT * INTO v_stats FROM public.researcher_stats WHERE researcher_id = p_researcher;
  SELECT COALESCE(EXTRACT(DAY FROM (now() - min(r.created_at)))::INT, 0) INTO v_age_days
    FROM public.reports r WHERE r.researcher_id = p_researcher;
  SELECT count(*) INTO v_verifs FROM public.researcher_verifications WHERE researcher_id = p_researcher AND status = 'verified';
  SELECT count(*) INTO v_viol FROM public.moderation_actions
    WHERE target_type = 'user' AND target_id IN (SELECT user_id FROM public.researcher_profiles WHERE id = p_researcher);
  IF v_stats IS NULL OR COALESCE(v_stats.total_reports,0) = 0 THEN v_accept_rate := 0;
  ELSE v_accept_rate := (COALESCE(v_stats.accepted_reports,0)::NUMERIC / v_stats.total_reports) * 100; END IF;
  v_score := LEAST(40, COALESCE(v_stats.accepted_reports,0) * 2)
    + LEAST(20, (v_accept_rate / 5)::INT)
    + LEAST(15, (v_age_days / 30)::INT)
    + LEAST(15, v_verifs * 5)
    + LEAST(10, COALESCE(v_stats.resolved_reports,0))
    - LEAST(30, v_viol * 10);
  v_score := GREATEST(0, LEAST(100, v_score));
  RETURN QUERY SELECT v_score, jsonb_build_object(
    'accepted_reports', COALESCE(v_stats.accepted_reports,0),
    'accept_rate', round(v_accept_rate,1),
    'account_age_days', v_age_days,
    'verifications', v_verifs,
    'violations', v_viol);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.company_trust(p_company UUID)
RETURNS TABLE(score INT, factors JSONB) AS $$
DECLARE v_verified BOOLEAN; v_programs INT; v_total INT; v_resolved INT;
  v_avg_resp_h NUMERIC; v_score INT;
BEGIN
  SELECT is_verified INTO v_verified FROM public.company_profiles WHERE id = p_company;
  SELECT count(*) INTO v_programs FROM public.programs WHERE company_id = p_company AND status = 'active';
  SELECT count(*), count(*) FILTER (WHERE r.status IN ('resolved','closed')) INTO v_total, v_resolved
    FROM public.reports r JOIN public.programs p ON p.id = r.program_id WHERE p.company_id = p_company;
  SELECT AVG(EXTRACT(EPOCH FROM (e.created_at - r.submitted_at))/3600) INTO v_avg_resp_h
    FROM public.report_events e JOIN public.reports r ON r.id = e.report_id
    JOIN public.programs p ON p.id = r.program_id
    WHERE p.company_id = p_company AND e.to_status = 'triaged' AND r.submitted_at IS NOT NULL;
  v_score := (CASE WHEN v_verified THEN 25 ELSE 5 END)
    + LEAST(20, v_programs * 5)
    + CASE WHEN v_total > 0 THEN LEAST(30, ((v_resolved::NUMERIC / v_total) * 30)::INT) ELSE 10 END
    + CASE WHEN v_avg_resp_h IS NULL THEN 5 WHEN v_avg_resp_h <= 24 THEN 15 WHEN v_avg_resp_h <= 72 THEN 10 ELSE 5 END;
  v_score := GREATEST(0, LEAST(100, v_score));
  RETURN QUERY SELECT v_score, jsonb_build_object(
    'verified', COALESCE(v_verified,false), 'active_programs', v_programs,
    'resolved_rate', CASE WHEN v_total>0 THEN round((v_resolved::NUMERIC/v_total)*100,1) ELSE 0 END,
    'avg_response_hours', round(COALESCE(v_avg_resp_h,0),1));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for new tables
ALTER TABLE public.researcher_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspicious_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rv_read" ON public.researcher_verifications;
CREATE POLICY "rv_read" ON public.researcher_verifications FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid())
  OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "rv_write" ON public.researcher_verifications;
CREATE POLICY "rv_write" ON public.researcher_verifications FOR ALL USING (
  public.has_role('admin') OR public.has_role('moderator')) WITH CHECK (true);
DROP POLICY IF EXISTS "kyc_read" ON public.kyc_reviews;
CREATE POLICY "kyc_read" ON public.kyc_reviews FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid())
  OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "kyc_insert" ON public.kyc_reviews;
CREATE POLICY "kyc_insert" ON public.kyc_reviews FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id=researcher_id AND rp.user_id=auth.uid()));
DROP POLICY IF EXISTS "kyc_admin" ON public.kyc_reviews;
CREATE POLICY "kyc_admin" ON public.kyc_reviews FOR UPDATE USING (
  public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "dv_read" ON public.domain_verifications;
CREATE POLICY "dv_read" ON public.domain_verifications FOR SELECT USING (
  public.has_role('admin') OR public.has_role('moderator')
  OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.company_members WHERE company_id=domain_verifications.company_id AND user_id=auth.uid()));
DROP POLICY IF EXISTS "dv_write" ON public.domain_verifications;
CREATE POLICY "dv_write" ON public.domain_verifications FOR ALL USING (
  public.has_role('admin') OR EXISTS(SELECT 1 FROM public.company_profiles WHERE id=company_id AND owner_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.company_members WHERE company_id=domain_verifications.company_id AND user_id=auth.uid()))
  WITH CHECK (true);
DROP POLICY IF EXISTS "se_admin" ON public.suspicious_events;
CREATE POLICY "se_admin" ON public.suspicious_events FOR ALL USING (
  public.has_role('admin') OR public.has_role('moderator')) WITH CHECK (true);
DROP POLICY IF EXISTS "ap_own" ON public.appeals;
CREATE POLICY "ap_own" ON public.appeals FOR SELECT USING (user_id=auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "ap_insert" ON public.appeals;
CREATE POLICY "ap_insert" ON public.appeals FOR INSERT WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS "ap_review" ON public.appeals;
CREATE POLICY "ap_review" ON public.appeals FOR UPDATE USING (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "pu_read" ON public.program_updates;
CREATE POLICY "pu_read" ON public.program_updates FOR SELECT USING (public.can_view_program(program_id, auth.uid()));
DROP POLICY IF EXISTS "pu_write" ON public.program_updates;
CREATE POLICY "pu_write" ON public.program_updates FOR ALL USING (
  EXISTS(SELECT 1 FROM public.programs p WHERE p.id=program_id AND (public.is_company_member(p.company_id, auth.uid()) OR public.has_role('admin'))))
  WITH CHECK (true);
DROP POLICY IF EXISTS "ts_read" ON public.trust_snapshots;
CREATE POLICY "ts_read" ON public.trust_snapshots FOR SELECT USING (true);
DROP POLICY IF EXISTS "rev_admin" ON public.platform_revenue;
CREATE POLICY "rev_admin" ON public.platform_revenue FOR ALL USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- Identity documents bucket (private; owner + staff only)
INSERT INTO storage.buckets (id, name, public) VALUES ('identity-documents','identity-documents', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "iddoc_select" ON storage.objects;
CREATE POLICY "iddoc_select" ON storage.objects FOR SELECT USING (bucket_id='identity-documents' AND auth.role()='authenticated');
DROP POLICY IF EXISTS "iddoc_upload" ON storage.objects;
CREATE POLICY "iddoc_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='identity-documents' AND auth.role()='authenticated');

-- Self-asserted email mark: only succeeds when the caller's JWT is confirmed
CREATE OR REPLACE FUNCTION public.mark_own_email_verified() RETURNS VOID AS $$
DECLARE v_rp UUID; v_confirmed BOOLEAN;
BEGIN
  SELECT (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL INTO v_confirmed;
  IF NOT COALESCE(v_confirmed, false) THEN RETURN; END IF;
  SELECT id INTO v_rp FROM public.researcher_profiles WHERE user_id = auth.uid();
  IF v_rp IS NULL THEN RETURN; END IF;
  INSERT INTO public.researcher_verifications(researcher_id, kind, status, verified_at)
  VALUES (v_rp, 'email', 'verified', now())
  ON CONFLICT (researcher_id, kind) DO UPDATE SET status = 'verified', verified_at = now(), updated_at = now();
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. HARDENED MONEY PATH + FLAG PROTECTION (idempotent)
-- All financial mutations go through these SECURITY DEFINER functions.
-- Direct table writes are locked down so client JWTs cannot move money.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_bounty(p_report UUID, p_amount NUMERIC)
RETURNS UUID AS $$
DECLARE v_program UUID; v_company UUID; v_researcher UUID; v_uid UUID;
  v_wallet UUID; v_award UUID; v_existing TEXT;
  v_fee_pct NUMERIC; v_fee NUMERIC; v_net NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT program_id, researcher_id INTO v_program, v_researcher FROM public.reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT company_id INTO v_company FROM public.programs WHERE id = v_program;
  IF NOT (public.is_company_member(v_company, v_uid) OR public.has_role('admin')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  SELECT status INTO v_existing FROM public.bounty_awards WHERE report_id = p_report;
  IF v_existing IN ('approved','paid') THEN RAISE EXCEPTION 'already awarded'; END IF;
  -- Platform commission (configurable, default 10%). Researcher receives the net.
  SELECT COALESCE((value->>'percent')::NUMERIC, (value)::NUMERIC, 10) INTO v_fee_pct
    FROM public.platform_settings WHERE key = 'platform_fee' LIMIT 1;
  IF v_fee_pct IS NULL THEN v_fee_pct := 10; END IF;
  v_fee_pct := GREATEST(0, LEAST(50, v_fee_pct));
  v_fee := round(p_amount * v_fee_pct / 100, 2);
  v_net := p_amount - v_fee;
  INSERT INTO public.bounty_awards(report_id, amount, status, awarded_by)
  VALUES (p_report, v_net, 'approved', v_uid)
  ON CONFLICT (report_id) DO UPDATE SET amount = v_net, status = 'approved', awarded_by = v_uid
  RETURNING id INTO v_award;
  INSERT INTO public.platform_revenue(award_id, gross_amount, fee_percent, fee_amount, net_amount)
  VALUES (v_award, p_amount, v_fee_pct, v_fee, v_net)
  ON CONFLICT (award_id) DO UPDATE SET gross_amount = p_amount, fee_percent = v_fee_pct, fee_amount = v_fee, net_amount = v_net;
  SELECT id INTO v_wallet FROM public.wallets WHERE researcher_id = v_researcher;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  UPDATE public.wallets SET pending_balance = pending_balance + v_net, total_earned = total_earned + v_net, updated_at = now() WHERE id = v_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
  SELECT v_wallet, 'bounty', v_net, balance, p_report, 'Bounty approved net of ' || v_fee_pct || '% platform fee (pending payment)', v_uid FROM public.wallets WHERE id = v_wallet;
  UPDATE public.reports SET status = 'accepted', bounty_amount = v_net, updated_at = now() WHERE id = p_report;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'award', 'bounty_awards', v_award, jsonb_build_object('report_id', p_report, 'gross', p_amount, 'fee', v_fee, 'net', v_net));
  RETURN v_award;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pay_award(p_award UUID, p_reference TEXT)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_amount NUMERIC; v_status TEXT; v_report UUID;
  v_researcher UUID; v_wallet UUID; v_program UUID; v_company UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT amount, status, report_id INTO v_amount, v_status, v_report FROM public.bounty_awards WHERE id = p_award;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT program_id, researcher_id INTO v_program, v_researcher FROM public.reports WHERE id = v_report;
  SELECT company_id INTO v_company FROM public.programs WHERE id = v_program;
  IF NOT (public.is_company_member(v_company, v_uid) OR public.has_role('admin')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_status = 'paid' THEN RAISE EXCEPTION 'already paid'; END IF;
  IF p_reference IS NULL OR char_length(trim(p_reference)) = 0 THEN RAISE EXCEPTION 'reference required'; END IF;
  UPDATE public.bounty_awards SET status = 'paid', decided_at = now() WHERE id = p_award;
  INSERT INTO public.bounty_payments(award_id, amount, status, reference, processed_by)
  VALUES (p_award, v_amount, 'completed', trim(p_reference), v_uid);
  SELECT id INTO v_wallet FROM public.wallets WHERE researcher_id = v_researcher;
  IF v_wallet IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + v_amount,
      pending_balance = GREATEST(0, pending_balance - v_amount), updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    SELECT v_wallet, 'bounty', v_amount, balance, p_award, 'Bounty paid (ref ' || trim(p_reference) || ')', v_uid FROM public.wallets WHERE id = v_wallet;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'bounty_awards', p_award, jsonb_build_object('amount', v_amount, 'reference', trim(p_reference)));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.settle_payout(p_payout UUID, p_approve BOOLEAN)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row RECORD; v_wallet UUID; v_nb NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.payout_requests WHERE id = p_payout;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
  IF p_approve THEN
    SELECT id, balance INTO v_wallet, v_nb FROM public.wallets WHERE researcher_id = v_row.researcher_id;
    IF v_wallet IS NULL OR v_nb < v_row.amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
    v_nb := v_nb - v_row.amount;
    UPDATE public.wallets SET balance = v_nb, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_wallet, 'payout', -v_row.amount, v_nb, p_payout, 'Payout approved', v_uid);
    UPDATE public.payout_requests SET status = 'completed', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  ELSE
    UPDATE public.payout_requests SET status = 'rejected', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'payout_requests', p_payout, jsonb_build_object('approved', p_approve, 'amount', v_row.amount));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Report timeline events: participants may append (company/staff/reporter), never edit
DROP POLICY IF EXISTS "re_insert" ON public.report_events;
CREATE POLICY "re_insert" ON public.report_events FOR INSERT WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.reports r
    LEFT JOIN public.researcher_profiles rp ON rp.id = r.researcher_id AND rp.user_id = auth.uid()
    LEFT JOIN public.programs p ON p.id = r.program_id
    LEFT JOIN public.company_members cm ON cm.company_id = p.company_id AND cm.user_id = auth.uid()
    WHERE r.id = report_id AND (rp.id IS NOT NULL OR cm.user_id IS NOT NULL)
  ) OR public.has_role('admin') OR public.has_role('moderator'));

-- Conversation invites: self-join or existing member (or admin). No arbitrary additions.
-- Single visibility rule for programs: public-active for all, private only for
-- invited researchers, owning team, staff, or creator. Used by every policy.
CREATE OR REPLACE FUNCTION public.can_view_program(p_program UUID, p_user UUID) RETURNS BOOLEAN AS $$
DECLARE v_status TEXT; v_vis TEXT; v_company UUID; v_creator UUID;
BEGIN
  SELECT status::TEXT, visibility::TEXT, company_id, created_by
    INTO v_status, v_vis, v_company, v_creator FROM public.programs WHERE id = p_program;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_status = 'active' AND v_vis = 'public' THEN RETURN true; END IF;
  IF p_user IS NULL THEN RETURN false; END IF;
  IF v_creator = p_user THEN RETURN true; END IF;
  IF public.is_company_member(v_company, p_user) THEN RETURN true; END IF;
  IF public.has_role('admin') OR public.has_role('moderator') THEN RETURN true; END IF;
  RETURN EXISTS(
    SELECT 1 FROM public.program_researchers pr
    JOIN public.researcher_profiles rp ON rp.id = pr.researcher_id
    WHERE pr.program_id = p_program AND rp.user_id = p_user AND pr.status = 'accepted');
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conv UUID, p_user UUID) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id = p_conv AND user_id = p_user); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP POLICY IF EXISTS "cmem_insert" ON public.conversation_members;
CREATE POLICY "cmem_insert" ON public.conversation_members FOR INSERT WITH CHECK (
  user_id = auth.uid() OR public.has_role('admin') OR public.is_conversation_member(conversation_id, auth.uid()));

-- Awards: admin-only direct writes (everyone else goes through award_bounty/pay_award)
DROP POLICY IF EXISTS "ba_write" ON public.bounty_awards;
CREATE POLICY "ba_write" ON public.bounty_awards FOR ALL USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- Privilege flags can only be flipped by admins (never by the row owner)
CREATE OR REPLACE FUNCTION public.protect_profile_flags() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'forbidden: is_active is admin-only';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_protect_profile ON public.profiles;
CREATE TRIGGER trg_protect_profile BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_flags();

CREATE OR REPLACE FUNCTION public.protect_company_verified() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified AND NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'forbidden: verification is admin-only';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_protect_verified ON public.company_profiles;
CREATE TRIGGER trg_protect_verified BEFORE UPDATE ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_company_verified();

-- Auto-award merit badges from real achievements (idempotent)
CREATE OR REPLACE FUNCTION public.check_merit_badges(p_researcher UUID)
RETURNS VOID AS $$
DECLARE v_accepted INT; v_critical_resolved INT; v_badge UUID;
BEGIN
  SELECT COALESCE(accepted_reports,0) INTO v_accepted FROM public.researcher_stats WHERE researcher_id = p_researcher;
  SELECT count(*) INTO v_critical_resolved FROM public.reports
  WHERE researcher_id = p_researcher AND severity = 'critical' AND status = 'resolved';
  SELECT id INTO v_badge FROM public.badges WHERE code = 'first-blood';
  IF v_accepted >= 1 AND v_badge IS NOT NULL THEN
    INSERT INTO public.researcher_badges(researcher_id, badge_id) VALUES (p_researcher, v_badge) ON CONFLICT DO NOTHING;
    INSERT INTO public.achievements(researcher_id, title, description, points)
    SELECT p_researcher, 'First accepted report', 'Your first report was accepted', 10
    WHERE NOT EXISTS (SELECT 1 FROM public.achievements WHERE researcher_id = p_researcher AND title = 'First accepted report');
  END IF;
  SELECT id INTO v_badge FROM public.badges WHERE code = 'bug-hunter';
  IF v_accepted >= 10 AND v_badge IS NOT NULL THEN
    INSERT INTO public.researcher_badges(researcher_id, badge_id) VALUES (p_researcher, v_badge) ON CONFLICT DO NOTHING;
    INSERT INTO public.achievements(researcher_id, title, description, points)
    SELECT p_researcher, '10 accepted reports', 'Double-digit accepted reports', 50
    WHERE NOT EXISTS (SELECT 1 FROM public.achievements WHERE researcher_id = p_researcher AND title = '10 accepted reports');
  END IF;
  SELECT id INTO v_badge FROM public.badges WHERE code = 'critical-hunter';
  IF v_critical_resolved >= 1 AND v_badge IS NOT NULL THEN
    INSERT INTO public.researcher_badges(researcher_id, badge_id) VALUES (p_researcher, v_badge) ON CONFLICT DO NOTHING;
    INSERT INTO public.achievements(researcher_id, title, description, points)
    SELECT p_researcher, 'Critical resolved', 'A critical report you found was resolved', 60
    WHERE NOT EXISTS (SELECT 1 FROM public.achievements WHERE researcher_id = p_researcher AND title = 'Critical resolved');
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Payment method types: allow mobile wallets on existing databases
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_type_check') THEN
    ALTER TABLE public.payment_methods DROP CONSTRAINT payment_methods_type_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_type_allowed') THEN
    ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_type_allowed
    CHECK (type IN ('bank','wallet','vodafone_cash','instapay','other'));
  END IF;
END $$;

-- Program invitations: researcher must accept before access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'program_researchers' AND column_name = 'status') THEN
    ALTER TABLE public.program_researchers ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'));
  END IF;
END $$;

-- Escrow payout flow: pending → approved (company funded platform) → completed (researcher paid)
CREATE OR REPLACE FUNCTION public.settle_payout(p_payout UUID, p_approve BOOLEAN)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row RECORD; v_wallet UUID; v_nb NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.payout_requests WHERE id = p_payout;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF p_approve THEN
    IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
    SELECT id, balance INTO v_wallet, v_nb FROM public.wallets WHERE researcher_id = v_row.researcher_id;
    IF v_wallet IS NULL OR v_nb < v_row.amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
    v_nb := v_nb - v_row.amount;
    UPDATE public.wallets SET balance = v_nb, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_wallet, 'payout', -v_row.amount, v_nb, p_payout, 'Payout approved: company funded platform, held in escrow', v_uid);
    UPDATE public.payout_requests SET status = 'approved', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  ELSE
    IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
    UPDATE public.payout_requests SET status = 'rejected', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'payout_requests', p_payout, jsonb_build_object('approved', p_approve, 'amount', v_row.amount));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.complete_payout(p_payout UUID, p_reference TEXT)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.payout_requests WHERE id = p_payout;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_row.status <> 'approved' THEN RAISE EXCEPTION 'must approve funding first'; END IF;
  IF p_reference IS NULL OR char_length(trim(p_reference)) = 0 THEN RAISE EXCEPTION 'reference required'; END IF;
  UPDATE public.payout_requests SET status = 'completed', review_note = trim(p_reference), updated_at = now() WHERE id = p_payout;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'payout_requests', p_payout, jsonb_build_object('completed', true, 'reference', trim(p_reference)));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trust badges seed
INSERT INTO public.badges(code,name_ar,name_en,description_en,icon) VALUES
 ('verified-researcher','باحث موثق','Verified Researcher','Identity verified by review','shield-check'),
 ('trusted-researcher','باحث جدير بالثقة','Trusted Researcher','High trust score sustained','star'),
 ('verified-company','شركة موثقة','Verified Company','Business verification approved','building')
 ON CONFLICT (code) DO NOTHING;
