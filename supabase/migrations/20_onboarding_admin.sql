-- 20 — Onboarding & admin reports (2026-11)
-- Idempotent. Adds the columns the registration wizard writes and the
-- admin analytics page reads. No new tables => no new RLS policies.

-- Researcher onboarding answers (registration wizard step 2)
ALTER TABLE public.researcher_profiles
  ADD COLUMN IF NOT EXISTS experience_level TEXT
  CHECK (experience_level IN ('beginner','intermediate','advanced','expert'));

-- Company onboarding answers (registration wizard step 2, prefill for /company/onboarding)
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS size TEXT
  CHECK (size IN ('1-10','11-50','51-200','201-1000','1000+'));
