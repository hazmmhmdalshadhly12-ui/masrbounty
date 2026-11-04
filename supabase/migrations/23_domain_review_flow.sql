-- ============================================================
-- Migration 23 — Domain review flow (توثيق الدومين بموافقة مشرف/أدمن)
--
-- What changed:
--   1. company_domains.status gains 'awaiting_approval': after the technical
--      check (DNS TXT / file) passes, the row is NOT verified yet — a
--      supervisor (moderator) or admin must approve it from
--      /admin/verification. Publish gate (checkPublishReadiness) still
--      requires status='verified'.
--   2. Review trail columns: reviewed_by / review_note / technical_check_passed
--      / checked_at — who approved or rejected, when, and whether the technical
--      proof (TXT record / file) was seen.
--
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1) Widen the status CHECK constraint to include 'awaiting_approval'
ALTER TABLE public.company_domains DROP CONSTRAINT IF EXISTS company_domains_status_check;
ALTER TABLE public.company_domains
  ADD CONSTRAINT company_domains_status_check
  CHECK (status IN ('pending', 'awaiting_approval', 'verified', 'failed', 'expired'));

-- 2) Review trail columns (add if missing)
ALTER TABLE public.company_domains
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.company_domains
  ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE public.company_domains
  ADD COLUMN IF NOT EXISTS technical_check_passed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.company_domains
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

-- 3) Index for the approval queue (admin/moderator list of awaiting rows)
CREATE INDEX IF NOT EXISTS idx_company_domains_awaiting
  ON public.company_domains(status, created_at)
  WHERE status = 'awaiting_approval';

-- 4) domain_verification_attempts.result may record the new intermediate state
ALTER TABLE public.domain_verification_attempts DROP CONSTRAINT IF EXISTS domain_verification_attempts_result_check;
ALTER TABLE public.domain_verification_attempts
  ADD CONSTRAINT domain_verification_attempts_result_check
  CHECK (result IN ('verified', 'awaiting_approval', 'failed', 'pending', 'expired'));

-- 5) AI lesson topic storage — enables idempotent regeneration (dedupe):
-- generateLessonAiAction stores the requested topic so a repeat request for
-- the same unreviewed draft returns the existing lesson instead of looping
-- through another paid generation.
ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS ai_topic TEXT;

-- 6) Comment for future maintainers
COMMENT ON COLUMN public.company_domains.status IS
  'pending=token issued, awaiting_approval=technical proof seen but NOT yet approved by staff, verified=approved by admin/moderator, failed, expired';
