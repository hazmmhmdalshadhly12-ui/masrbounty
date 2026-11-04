-- ==============================================================
-- MasrBounty MIGRATION 19 — AI, Academy, Certificates, Reputation
-- ==============================================================
-- WHEN TO RUN: once, in Supabase SQL Editor, on an EXISTING database
-- that was set up from supabase/masrbounty.sql BEFORE section 19 was
-- added. For a NEW database just run supabase/masrbounty.sql (it
-- already contains this section). Content is identical to §19 of the
-- master file and is idempotent (safe to re-run).
-- ==============================================================

-- 19.0 Column migrations for existing tables -------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS cwe TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS cvss_vector TEXT;

-- 19.1 AI infrastructure ----------------------------------------------------
-- Platform-wide AI configuration (single row). Secrets (AI_API_KEY /
-- AI_API_BASE_URL / AI_MODEL) live ONLY in Cloudflare Pages environment
-- variables — never in this table, never in the frontend.
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  daily_limit_per_user INT NOT NULL DEFAULT 25 CHECK (daily_limit_per_user BETWEEN 1 AND 1000),
  per_minute_limit INT NOT NULL DEFAULT 6 CHECK (per_minute_limit BETWEEN 1 AND 120),
  monthly_budget_requests BIGINT NOT NULL DEFAULT 20000 CHECK (monthly_budget_requests > 0),
  allowed_features TEXT[] NOT NULL DEFAULT ARRAY['report_assistant','lesson_generator']::TEXT[],
  allowed_models TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  default_model TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
INSERT INTO public.ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Per-request AI consumption log. Written ONLY server-side via the service
-- role (no INSERT policy on purpose — users can never forge usage rows and
-- can only read their own).
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT,
  ok BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  prompt_tokens INT NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens INT NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage_logs(feature, created_at DESC);

-- 19.2 Academy (Penetration Testing Academy) ---------------------------------
CREATE TABLE IF NOT EXISTS public.academy_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  level TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
  category TEXT NOT NULL DEFAULT 'general',
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_free BOOLEAN NOT NULL DEFAULT true,
  price NUMERIC(10,2) CHECK (price IS NULL OR price >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.academy_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  objectives TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  content_ar TEXT,
  content_en TEXT,
  video_url TEXT,
  attachment_path TEXT,           -- path inside the private 'academy-materials' bucket
  duration_minutes INT NOT NULL DEFAULT 15 CHECK (duration_minutes BETWEEN 1 AND 480),
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  generated_by_ai BOOLEAN NOT NULL DEFAULT false,
  ai_reviewed BOOLEAN NOT NULL DEFAULT false,
  quiz JSONB CHECK (quiz IS NULL OR jsonb_typeof(quiz) = 'array'),
  quiz_pass_score INT NOT NULL DEFAULT 70 CHECK (quiz_pass_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_academy_lessons_course ON public.academy_lessons(course_id, sort_order);

CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_academy_enroll_user ON public.academy_enrollments(user_id);

CREATE TABLE IF NOT EXISTS public.academy_lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (lesson_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_academy_progress_user ON public.academy_lesson_progress(user_id);

CREATE TABLE IF NOT EXISTS public.academy_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_academy_quiz_user ON public.academy_quiz_attempts(user_id, lesson_id);

-- 19.3 Certificates (verifiable) ----------------------------------------------
CREATE SEQUENCE IF NOT EXISTS certificate_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_number TEXT NOT NULL UNIQUE
    DEFAULT ('MB-CERT-' || lpad(nextval('certificate_number_seq')::TEXT, 6, '0')),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('academy_course','academy_path','bug_bounty_achievement')),
  course_id UUID REFERENCES public.academy_courses(id) ON DELETE SET NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','revoked')),
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, type, course_id)
);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates(user_id);

-- 19.4 Reputation ledger + researcher levels ----------------------------------
-- Append-only ledger of every score change. Written only by SECURITY DEFINER
-- functions (refresh_researcher_stats / adjust_reputation); users can read
-- their own rows, admins can audit everyone, nobody can UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS public.reputation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  delta INT NOT NULL,
  score_after INT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('report','adjustment','education','system')),
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rep_events_researcher ON public.reputation_events(researcher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.researcher_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  min_score INT NOT NULL DEFAULT 0 CHECK (min_score >= 0),
  min_accepted INT NOT NULL DEFAULT 0 CHECK (min_accepted >= 0),
  requires_identity_verified BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
INSERT INTO public.researcher_levels (code, name_ar, name_en, min_score, min_accepted, requires_identity_verified, sort_order) VALUES
  ('beginner',  'باحث مبتدئ',      'Beginner Researcher',   0,    0,  false, 1),
  ('verified',  'باحث موثّق',      'Verified Researcher',   20,   1,  true,  2),
  ('skilled',   'باحث ماهر',       'Skilled Researcher',    100,  5,  false, 3),
  ('advanced',  'باحث متقدم',      'Advanced Researcher',   250,  12, false, 4),
  ('expert',    'باحث خبير',       'Expert Researcher',     500,  25, true,  5),
  ('elite',     'باحث نخبة',       'Elite Researcher',      1000, 50, true,  6)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.researcher_reputation
  ADD COLUMN IF NOT EXISTS bonus_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.researcher_levels(id);

-- Admin-tunable reputation weights (fallback defaults are applied in SQL).
INSERT INTO public.platform_settings (key, value) VALUES
  ('reputation_weights', '{"accepted":10,"resolved":20,"critical":50,"high":20,"medium":10,"low":5,"informational":1,"duplicate":0,"invalid":0}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Academy graduate badge (awarded server-side when a course certificate is
-- first issued). Educational badge — explicitly NOT a professional credential.
INSERT INTO public.badges (code, name_ar, name_en, description_ar, description_en, icon) VALUES
  ('academy-graduate', 'خريج الأكاديمية', 'Academy Graduate',
   'أكمل دورة تعليمية كاملة في أكاديمية اختبار الاختراق — شهادة تعليمية لا تعني اعتمادًا مهنيًا.',
   'Completed an academy course. Educational achievement — not a professional certification.', 'graduation-cap')
ON CONFLICT (code) DO NOTHING;

-- 19.5 Daily report limits & anti-abuse ----------------------------------------
-- Platform defaults (admin-editable via platform_settings) + per-user
-- overrides. The limit applies to SUBMISSIONS only — drafts and edits of
-- existing reports are never limited.
INSERT INTO public.platform_settings (key, value) VALUES
  ('report_limits', '{"daily_max":10,"hourly_max":5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.report_limit_overrides (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  daily_limit INT CHECK (daily_limit IS NULL OR daily_limit BETWEEN 0 AND 1000),
  hourly_limit INT CHECK (hourly_limit IS NULL OR hourly_limit BETWEEN 0 AND 1000),
  reason TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 19.6 Academy storage bucket (private; access via signed URLs) ----------------
INSERT INTO storage.buckets (id, name, public) VALUES ('academy-materials','academy-materials', false) ON CONFLICT (id) DO NOTHING;
-- Path layout: academy-materials/<course_id>/<filename>
DROP POLICY IF EXISTS "academy_materials_admin_write" ON storage.objects;
CREATE POLICY "academy_materials_admin_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'academy-materials'
  AND (public.has_role('admin') OR public.has_role('moderator'))
  AND EXISTS(SELECT 1 FROM public.academy_courses c WHERE c.id::text = (storage.foldername(name))[1])
);
DROP POLICY IF EXISTS "academy_materials_admin_update" ON storage.objects;
CREATE POLICY "academy_materials_admin_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'academy-materials'
  AND (public.has_role('admin') OR public.has_role('moderator'))
);
DROP POLICY IF EXISTS "academy_materials_admin_delete" ON storage.objects;
CREATE POLICY "academy_materials_admin_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'academy-materials'
  AND (public.has_role('admin') OR public.has_role('moderator'))
);
-- Read: staff, or learners enrolled in the (published) course that owns the folder.
DROP POLICY IF EXISTS "academy_materials_read" ON storage.objects;
CREATE POLICY "academy_materials_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'academy-materials'
  AND (
    (public.has_role('admin') OR public.has_role('moderator'))
    OR EXISTS(
      SELECT 1
      FROM public.academy_courses c
      JOIN public.academy_enrollments e ON e.course_id = c.id
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.is_published
        AND e.user_id = auth.uid()
    )
  )
);

-- 19.7 Functions ---------------------------------------------------------------
-- Weighted reputation recalculation (replaces the §5 version). Reads weights
-- from platform_settings (admin-tunable) with hardcoded fallbacks; keeps the
-- admin bonus; assigns the researcher level; appends the reputation ledger;
-- then re-checks merit badges. Never raises for data reasons.
CREATE OR REPLACE FUNCTION public.refresh_researcher_stats(p_researcher UUID) RETURNS VOID AS $$
DECLARE
  w JSONB;
  v_accepted INT; v_resolved INT; v_crit INT; v_high INT; v_med INT; v_low INT; v_info INT;
  v_computed INT;
  v_old_score INT;
  v_new_score INT;
  v_bonus INT;
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

  SELECT accepted_reports, resolved_reports, critical_count, high_count, medium_count, low_count,
         GREATEST(total_reports - accepted_reports - duplicate_reports, 0)
    INTO v_accepted, v_resolved, v_crit, v_high, v_med, v_low, v_info
  FROM public.researcher_stats WHERE researcher_id = p_researcher;

  w := COALESCE((SELECT value FROM public.platform_settings WHERE key = 'reputation_weights'), '{}'::jsonb);
  v_computed :=
      v_accepted * COALESCE((w->>'accepted')::int, 10)
    + v_resolved * COALESCE((w->>'resolved')::int, 20)
    + v_crit     * COALESCE((w->>'critical')::int, 50)
    + v_high     * COALESCE((w->>'high')::int, 20)
    + v_med      * COALESCE((w->>'medium')::int, 10)
    + v_low      * COALESCE((w->>'low')::int, 5)
    + v_info     * COALESCE((w->>'informational')::int, 1);

  SELECT score, COALESCE(bonus_score, 0) INTO v_old_score, v_bonus
  FROM public.researcher_reputation WHERE researcher_id = p_researcher;

  UPDATE public.researcher_reputation SET
    score = v_computed + v_bonus,
    level_id = (
      SELECT l.id FROM public.researcher_levels l
      WHERE l.is_active
        AND l.min_score <= v_computed + v_bonus
        AND l.min_accepted <= v_accepted
        AND (NOT l.requires_identity_verified OR EXISTS(
          SELECT 1 FROM public.researcher_verifications v
          WHERE v.researcher_id = p_researcher AND v.kind = 'identity' AND v.status = 'verified'))
      ORDER BY l.sort_order DESC
      LIMIT 1
    ),
    updated_at = now()
  WHERE researcher_id = p_researcher
  RETURNING score INTO v_new_score;

  IF v_new_score IS NOT NULL AND v_new_score IS DISTINCT FROM v_old_score THEN
    INSERT INTO public.reputation_events(researcher_id, delta, score_after, source, reason)
    VALUES (p_researcher, v_new_score - COALESCE(v_old_score, 0), v_new_score, 'report', 'إعادة احتساب النقاط من إحصائيات التقارير');
  END IF;

  PERFORM public.check_merit_badges(p_researcher);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin-only reputation adjustment (positive or negative). Every adjustment
-- lands in the ledger + audit_logs. Users have NO policy to touch these rows.
CREATE OR REPLACE FUNCTION public.adjust_reputation(p_researcher UUID, p_delta INT, p_reason TEXT) RETURNS INT AS $$
DECLARE v_new INT; v_ruser UUID;
BEGIN
  IF NOT public.has_role('admin') THEN RAISE EXCEPTION 'للإدارة فقط'; END IF;
  IF p_delta IS NULL OR p_delta = 0 OR abs(p_delta) > 500 THEN RAISE EXCEPTION 'قيمة تعديل غير صالحة'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN RAISE EXCEPTION 'سبب التعديل مطلوب'; END IF;

  SELECT user_id INTO v_ruser FROM public.researcher_profiles WHERE id = p_researcher;

  UPDATE public.researcher_reputation
    SET bonus_score = COALESCE(bonus_score, 0) + p_delta,
        score = score + p_delta,
        updated_at = now()
    WHERE researcher_id = p_researcher
  RETURNING score INTO v_new;
  IF NOT FOUND THEN RAISE EXCEPTION 'الباحث غير موجود'; END IF;

  UPDATE public.researcher_reputation SET level_id = (
    SELECT l.id FROM public.researcher_levels l
    WHERE l.is_active
      AND l.min_score <= (SELECT score FROM public.researcher_reputation WHERE researcher_id = p_researcher)
      AND (NOT l.requires_identity_verified OR EXISTS(
        SELECT 1 FROM public.researcher_verifications v
        WHERE v.researcher_id = p_researcher AND v.kind = 'identity' AND v.status = 'verified'))
    ORDER BY l.sort_order DESC LIMIT 1
  ) WHERE researcher_id = p_researcher;

  INSERT INTO public.reputation_events(researcher_id, delta, score_after, source, actor_id, reason)
  VALUES (p_researcher, p_delta, v_new, 'adjustment', auth.uid(), btrim(p_reason));
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'update', 'reputation', p_researcher, jsonb_build_object('delta', p_delta, 'reason', btrim(p_reason)));
  RETURN v_new;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin-issued achievement certificate (Bug Bounty achievement). Requires a
-- real, reviewed basis recorded in p_reason; never auto-issued for mere
-- report submission.
CREATE OR REPLACE FUNCTION public.issue_achievement_certificate(p_user UUID, p_title_ar TEXT, p_title_en TEXT, p_reason TEXT) RETURNS TEXT AS $$
DECLARE v_cert TEXT; v_is_admin BOOLEAN;
BEGIN
  IF NOT (public.has_role('admin') OR public.has_role('moderator')) THEN RAISE EXCEPTION 'للإدارة فقط'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN RAISE EXCEPTION 'يجب توثيق أساس الإصدار (10 أحرف على الأقل)'; END IF;
  INSERT INTO public.certificates(user_id, type, title_ar, title_en, issued_by, metadata)
  VALUES (p_user, 'bug_bounty_achievement', btrim(p_title_ar), btrim(p_title_en), auth.uid(),
          jsonb_build_object('basis', btrim(p_reason)))
  RETURNING certificate_number INTO v_cert;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'create', 'certificate', p_user, jsonb_build_object('certificate_number', v_cert, 'reason', btrim(p_reason)));
  RETURN v_cert;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin revoke (status can only go valid -> revoked; no un-revoke policy).
CREATE OR REPLACE FUNCTION public.revoke_certificate(p_certificate UUID, p_reason TEXT) RETURNS VOID AS $$
BEGIN
  IF NOT (public.has_role('admin') OR public.has_role('moderator')) THEN RAISE EXCEPTION 'للإدارة فقط'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN RAISE EXCEPTION 'سبب الإلغاء مطلوب'; END IF;
  UPDATE public.certificates
    SET status = 'revoked', revoked_at = now(), revoked_reason = btrim(p_reason)
    WHERE id = p_certificate AND status = 'valid';
  IF NOT FOUND THEN RAISE EXCEPTION 'الشهادة غير موجودة أو ملغاة مسبقًا'; END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'update', 'certificate', p_certificate, jsonb_build_object('revoked_reason', btrim(p_reason)));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public, privacy-safe certificate verification (anon-callable via RPC).
-- Returns ONLY public fields — no user ids, no emails.
CREATE OR REPLACE FUNCTION public.verify_certificate(p_number TEXT) RETURNS TABLE(
  certificate_number TEXT, holder_name TEXT, title TEXT, issued_at TIMESTAMPTZ, status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.certificate_number,
         COALESCE(rp.display_name, pr.username) AS holder_name,
         COALESCE(c.title_ar, c.title_en) AS title,
         c.created_at,
         c.status
  FROM public.certificates c
  JOIN public.profiles pr ON pr.id = c.user_id
  LEFT JOIN public.researcher_profiles rp ON rp.user_id = c.user_id
  WHERE c.certificate_number = btrim(p_number);
END; $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Academy: course progress for the caller (or a given user for staff views).
CREATE OR REPLACE FUNCTION public.academy_course_progress(p_course UUID) RETURNS TABLE(total_lessons INT, completed_lessons INT, percent INT) AS $$
DECLARE v_total INT; v_done INT; v_user UUID := auth.uid();
BEGIN
  SELECT count(*) INTO v_total FROM public.academy_lessons WHERE course_id = p_course AND is_published;
  SELECT count(*) INTO v_done
  FROM public.academy_lesson_progress p
  JOIN public.academy_lessons l ON l.id = p.lesson_id
  WHERE l.course_id = p_course AND l.is_published AND p.user_id = v_user;
  RETURN QUERY SELECT v_total, v_done,
    CASE WHEN v_total = 0 THEN 0 ELSE LEAST(100, (v_done * 100) / v_total) END;
END; $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Academy: auto-issue the course certificate exactly once, when the learner
-- completes ALL published lessons of a published course they are enrolled in.
CREATE OR REPLACE FUNCTION public.issue_course_certificate(p_course UUID) RETURNS TEXT AS $$
DECLARE v_user UUID := auth.uid(); v_cert TEXT; v_total INT; v_done INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.academy_enrollments WHERE course_id = p_course AND user_id = v_user) THEN
    RAISE EXCEPTION 'غير مسجل في الدورة';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.academy_courses WHERE id = p_course AND is_published) THEN
    RAISE EXCEPTION 'الدورة غير منشورة';
  END IF;
  SELECT total_lessons, completed_lessons INTO v_total, v_done FROM public.academy_course_progress(p_course);
  IF v_total = 0 OR v_done < v_total THEN RAISE EXCEPTION 'لم تكتمل جميع الدروس بعد'; END IF;

  UPDATE public.academy_enrollments SET completed_at = now()
    WHERE course_id = p_course AND user_id = v_user AND completed_at IS NULL;

  INSERT INTO public.certificates(user_id, type, course_id, title_ar, title_en)
  SELECT v_user, 'academy_course', c.id, c.title_ar, c.title_en
  FROM public.academy_courses c WHERE c.id = p_course
  ON CONFLICT (user_id, type, course_id) DO NOTHING
  RETURNING certificate_number INTO v_cert;

  IF v_cert IS NULL THEN
    SELECT certificate_number INTO v_cert FROM public.certificates
    WHERE user_id = v_user AND type = 'academy_course' AND course_id = p_course;
  END IF;
  RETURN v_cert;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 19.8 RLS: enable + policies ---------------------------------------------------
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researcher_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_limit_overrides ENABLE ROW LEVEL SECURITY;

-- AI settings: staff read, admin write.
DROP POLICY IF EXISTS "ai_settings_read" ON public.ai_settings;
CREATE POLICY "ai_settings_read" ON public.ai_settings FOR SELECT USING (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "ai_settings_write" ON public.ai_settings;
CREATE POLICY "ai_settings_write" ON public.ai_settings FOR UPDATE USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- AI usage logs: user sees own rows only; staff audit all; no write policies
-- (server-side service-role writes only; RLS blocks user inserts/updates).
DROP POLICY IF EXISTS "ai_usage_read_own" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_read_own" ON public.ai_usage_logs FOR SELECT
  USING (user_id = auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));

-- Academy courses.
DROP POLICY IF EXISTS "academy_courses_read" ON public.academy_courses;
CREATE POLICY "academy_courses_read" ON public.academy_courses FOR SELECT
  USING (is_published OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_courses_staff_insert" ON public.academy_courses;
CREATE POLICY "academy_courses_staff_insert" ON public.academy_courses FOR INSERT
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_courses_staff_update" ON public.academy_courses;
CREATE POLICY "academy_courses_staff_update" ON public.academy_courses FOR UPDATE
  USING (public.has_role('admin') OR public.has_role('moderator')) WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_courses_admin_delete" ON public.academy_courses;
CREATE POLICY "academy_courses_admin_delete" ON public.academy_courses FOR DELETE USING (public.has_role('admin'));

-- Academy lessons (published lessons of published courses are public-readable).
DROP POLICY IF EXISTS "academy_lessons_read" ON public.academy_lessons;
CREATE POLICY "academy_lessons_read" ON public.academy_lessons FOR SELECT
  USING (
    (is_published AND EXISTS(SELECT 1 FROM public.academy_courses c WHERE c.id = course_id AND c.is_published))
    OR public.has_role('admin') OR public.has_role('moderator')
  );
DROP POLICY IF EXISTS "academy_lessons_staff_insert" ON public.academy_lessons;
CREATE POLICY "academy_lessons_staff_insert" ON public.academy_lessons FOR INSERT
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_lessons_staff_update" ON public.academy_lessons;
CREATE POLICY "academy_lessons_staff_update" ON public.academy_lessons FOR UPDATE
  USING (public.has_role('admin') OR public.has_role('moderator')) WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_lessons_admin_delete" ON public.academy_lessons;
CREATE POLICY "academy_lessons_admin_delete" ON public.academy_lessons FOR DELETE USING (public.has_role('admin'));

-- Enrollments: own rows only, into published courses (staff exempt via RPC? —
-- staff manage rows directly with the same policy; they enroll themselves).
DROP POLICY IF EXISTS "academy_enroll_read" ON public.academy_enrollments;
CREATE POLICY "academy_enroll_read" ON public.academy_enrollments FOR SELECT
  USING (user_id = auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_enroll_insert" ON public.academy_enrollments;
CREATE POLICY "academy_enroll_insert" ON public.academy_enrollments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS(SELECT 1 FROM public.academy_courses c WHERE c.id = course_id AND c.is_published)
  );
DROP POLICY IF EXISTS "academy_enroll_delete" ON public.academy_enrollments;
CREATE POLICY "academy_enroll_delete" ON public.academy_enrollments FOR DELETE
  USING (user_id = auth.uid() OR public.has_role('admin'));

-- Lesson progress: own rows, for published lessons of published courses.
DROP POLICY IF EXISTS "academy_progress_read" ON public.academy_lesson_progress;
CREATE POLICY "academy_progress_read" ON public.academy_lesson_progress FOR SELECT
  USING (user_id = auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_progress_insert" ON public.academy_lesson_progress;
CREATE POLICY "academy_progress_insert" ON public.academy_lesson_progress FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS(
      SELECT 1 FROM public.academy_lessons l
      JOIN public.academy_courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND l.is_published AND c.is_published
    )
  );
DROP POLICY IF EXISTS "academy_progress_delete" ON public.academy_lesson_progress;
CREATE POLICY "academy_progress_delete" ON public.academy_lesson_progress FOR DELETE USING (user_id = auth.uid());

-- Quiz attempts: own insert (enrolled + published lesson), own read, staff read.
DROP POLICY IF EXISTS "academy_quiz_read" ON public.academy_quiz_attempts;
CREATE POLICY "academy_quiz_read" ON public.academy_quiz_attempts FOR SELECT
  USING (user_id = auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "academy_quiz_insert" ON public.academy_quiz_attempts;
CREATE POLICY "academy_quiz_insert" ON public.academy_quiz_attempts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS(
      SELECT 1 FROM public.academy_lessons l
      JOIN public.academy_courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND l.is_published AND c.is_published
    )
    AND EXISTS(SELECT 1 FROM public.academy_enrollments e WHERE e.course_id = (SELECT course_id FROM public.academy_lessons WHERE id = lesson_id) AND e.user_id = auth.uid())
  );

-- Certificates: own/staff read; staff manage; nobody else.
DROP POLICY IF EXISTS "certificates_read" ON public.certificates;
CREATE POLICY "certificates_read" ON public.certificates FOR SELECT
  USING (user_id = auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "certificates_staff_insert" ON public.certificates;
CREATE POLICY "certificates_staff_insert" ON public.certificates FOR INSERT
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "certificates_staff_update" ON public.certificates;
CREATE POLICY "certificates_staff_update" ON public.certificates FOR UPDATE
  USING (public.has_role('admin') OR public.has_role('moderator')) WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "certificates_admin_delete" ON public.certificates;
CREATE POLICY "certificates_admin_delete" ON public.certificates FOR DELETE USING (public.has_role('admin'));

-- Reputation ledger: own read + staff audit; writes ONLY via SECURITY DEFINER
-- functions (no INSERT/UPDATE/DELETE policies on purpose).
DROP POLICY IF EXISTS "rep_events_read" ON public.reputation_events;
CREATE POLICY "rep_events_read" ON public.reputation_events FOR SELECT
  USING (
    EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = researcher_id AND rp.user_id = auth.uid())
    OR public.has_role('admin') OR public.has_role('moderator')
  );

-- Researcher levels: public read (shown on profiles), admin write.
DROP POLICY IF EXISTS "levels_read" ON public.researcher_levels;
CREATE POLICY "levels_read" ON public.researcher_levels FOR SELECT USING (true);
DROP POLICY IF EXISTS "levels_admin_insert" ON public.researcher_levels;
CREATE POLICY "levels_admin_insert" ON public.researcher_levels FOR INSERT WITH CHECK (public.has_role('admin'));
DROP POLICY IF EXISTS "levels_admin_update" ON public.researcher_levels;
CREATE POLICY "levels_admin_update" ON public.researcher_levels FOR UPDATE
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- Report limit overrides: staff manage; user may see their own override.
DROP POLICY IF EXISTS "rlo_read" ON public.report_limit_overrides;
CREATE POLICY "rlo_read" ON public.report_limit_overrides FOR SELECT
  USING (user_id = auth.uid() OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "rlo_admin_insert" ON public.report_limit_overrides;
CREATE POLICY "rlo_admin_insert" ON public.report_limit_overrides FOR INSERT WITH CHECK (public.has_role('admin'));
DROP POLICY IF EXISTS "rlo_admin_update" ON public.report_limit_overrides;
CREATE POLICY "rlo_admin_update" ON public.report_limit_overrides FOR UPDATE
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
DROP POLICY IF EXISTS "rlo_admin_delete" ON public.report_limit_overrides;
CREATE POLICY "rlo_admin_delete" ON public.report_limit_overrides FOR DELETE USING (public.has_role('admin'));

-- 19.9 Triggers ------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_touch_ai_settings ON public.ai_settings;
CREATE TRIGGER trg_touch_ai_settings BEFORE UPDATE ON public.ai_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_academy_courses ON public.academy_courses;
CREATE TRIGGER trg_touch_academy_courses BEFORE UPDATE ON public.academy_courses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_academy_lessons ON public.academy_lessons;
CREATE TRIGGER trg_touch_academy_lessons BEFORE UPDATE ON public.academy_lessons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_researcher_levels ON public.researcher_levels;
CREATE TRIGGER trg_touch_researcher_levels BEFORE UPDATE ON public.researcher_levels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_rlo ON public.report_limit_overrides;
CREATE TRIGGER trg_touch_rlo BEFORE UPDATE ON public.report_limit_overrides FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- reputation_events is append-only (same protection pattern as audit_logs).
CREATE OR REPLACE FUNCTION public.prevent_reputation_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'سجل السمعة للقراءة فقط (append-only)'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rep_events_immutable ON public.reputation_events;
CREATE TRIGGER trg_rep_events_immutable BEFORE UPDATE OR DELETE ON public.reputation_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_reputation_mutation();
