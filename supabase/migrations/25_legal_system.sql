-- ============================================================
-- 25. LEGAL DOCUMENTS, VERSIONING & USER ACCEPTANCES (idempotent)
--
--   legal_documents          : one row per policy (12 docs)
--   legal_document_versions  : immutable per-version content
--   legal_acceptances        : immutable user consent records
--
-- Rules enforced here:
--   * Published/superseded versions are IMMUTABLE — edits happen on
--     a NEW draft version only.
--   * Publishing is draft -> published only, and supersedes the
--     previously published version.
--   * A document can require re-acceptance after a major update;
--     users with an older accepted version are gated at login.
--   * Acceptance rows are append-only (no UPDATE/DELETE anywhere).
-- ============================================================

-- 25.1 Tables -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('core','bounty','company','researcher','data')),
  current_version INT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  requires_reacceptance BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 100,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content_md TEXT NOT NULL CHECK (char_length(content_md) BETWEEN 50 AND 200000),
  change_summary_ar TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded')),
  published_by UUID REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(document_id, version)
);
CREATE INDEX IF NOT EXISTS idx_legal_ver_doc ON public.legal_document_versions(document_id, version DESC);

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_slug TEXT NOT NULL,
  version INT NOT NULL CHECK (version > 0),
  context TEXT NOT NULL DEFAULT 'registration' CHECK (context IN ('registration','reacceptance','update')),
  age_confirmed BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_legal_acc_user ON public.legal_acceptances(user_id, document_slug, accepted_at DESC);

-- 25.2 Immutability triggers ----------------------------------
-- Acceptance records: never updated, never deleted. Append-only.
CREATE OR REPLACE FUNCTION public.prevent_acceptance_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'legal_acceptances is append-only (immutable consent record)';
END; $$ LANGUAGE plpgsql;

-- Published/superseded legal versions: immutable. Drafts stay editable.
CREATE OR REPLACE FUNCTION public.prevent_version_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'legal versions are append-only — supersede instead of deleting';
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'published legal versions are immutable — publish a new version instead';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legal_acc_immutable ON public.legal_acceptances;
CREATE TRIGGER legal_acc_immutable
  BEFORE UPDATE OR DELETE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_acceptance_mutation();

DROP TRIGGER IF EXISTS legal_ver_immutable ON public.legal_document_versions;
CREATE TRIGGER legal_ver_immutable
  BEFORE UPDATE OR DELETE ON public.legal_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_version_mutation();

DROP TRIGGER IF EXISTS legal_doc_touch ON public.legal_documents;
CREATE TRIGGER legal_doc_touch BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 25.3 RLS ----------------------------------------------------
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon visitors) can read documents + published/superseded versions.
DROP POLICY IF EXISTS "ld_select" ON public.legal_documents;
CREATE POLICY "ld_select" ON public.legal_documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "ldv_select" ON public.legal_document_versions;
CREATE POLICY "ldv_select" ON public.legal_document_versions FOR SELECT
  USING (status IN ('published','superseded') OR public.has_role('admin'));

-- Admins manage documents and versions; immutability trigger still blocks
-- any attempt to mutate published rows even with the service connection.
DROP POLICY IF EXISTS "ld_admin_write" ON public.legal_documents;
CREATE POLICY "ld_admin_write" ON public.legal_documents FOR ALL
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
DROP POLICY IF EXISTS "ldv_admin_write" ON public.legal_document_versions;
CREATE POLICY "ldv_admin_write" ON public.legal_document_versions FOR ALL
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- Acceptances: user reads own, admin reads all; inserts happen ONLY via
-- accept_legal_agreement() (no client INSERT policy at all).
DROP POLICY IF EXISTS "la_select_own" ON public.legal_acceptances;
CREATE POLICY "la_select_own" ON public.legal_acceptances FOR SELECT
  USING (user_id = auth.uid() OR public.has_role('admin'));

-- 25.4 Publish a draft version (draft -> published ONLY) ------
CREATE OR REPLACE FUNCTION public.publish_legal_version(
  p_document_slug TEXT, p_version INT, p_requires_reacceptance BOOLEAN DEFAULT false
) RETURNS VOID AS $$
DECLARE v_doc UUID; v_prev INT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO v_doc FROM public.legal_documents WHERE slug = p_document_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;

  -- only a DRAFT row with an exact version match can be published
  IF NOT EXISTS (
    SELECT 1 FROM public.legal_document_versions
     WHERE document_id = v_doc AND version = p_version AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'invalid state';
  END IF;

  SELECT current_version INTO v_prev FROM public.legal_documents WHERE id = v_doc FOR UPDATE;

  UPDATE public.legal_document_versions SET status = 'superseded'
   WHERE document_id = v_doc AND status = 'published';
  UPDATE public.legal_document_versions SET status = 'published', published_by = auth.uid(), published_at = now()
   WHERE document_id = v_doc AND version = p_version;

  UPDATE public.legal_documents
     SET current_version = p_version, status = 'published',
         requires_reacceptance = COALESCE(p_requires_reacceptance, false), updated_at = now()
   WHERE id = v_doc;

  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'legal.published', 'legal_documents', v_doc,
    jsonb_build_object('slug', p_document_slug, 'version', p_version, 'prev_version', v_prev,
      'requires_reacceptance', COALESCE(p_requires_reacceptance, false)));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 25.5 Record user acceptance (server-validated, append-only) --
CREATE OR REPLACE FUNCTION public.accept_legal_agreement(
  p_slugs TEXT[], p_versions INT[], p_age_confirmed BOOLEAN, p_context TEXT DEFAULT 'registration'
) RETURNS INT AS $$
DECLARE v_uid UUID; i INT; v_current INT; v_doc public.legal_documents%ROWTYPE; v_count INT := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_slugs IS NULL OR p_versions IS NULL OR array_length(p_slugs,1) IS NULL
     OR array_length(p_slugs,1) <> array_length(p_versions,1) THEN
    RAISE EXCEPTION 'invalid input';
  END IF;
  IF p_context NOT IN ('registration','reacceptance','update') THEN RAISE EXCEPTION 'invalid input'; END IF;
  IF p_age_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'age confirmation required'; END IF;

  FOR i IN 1..array_length(p_slugs,1) LOOP
    SELECT * INTO v_doc FROM public.legal_documents WHERE slug = p_slugs[i];
    IF NOT FOUND OR v_doc.status <> 'published' THEN
      RAISE EXCEPTION 'document not published: %', p_slugs[i];
    END IF;
    SELECT current_version INTO v_current FROM public.legal_documents WHERE id = v_doc.id;
    IF p_versions[i] IS NULL OR p_versions[i] <> v_current THEN
      RAISE EXCEPTION 'version mismatch: %', p_slugs[i];
    END IF;

    -- Idempotent per (user, doc, version)
    IF NOT EXISTS (
      SELECT 1 FROM public.legal_acceptances
       WHERE user_id = v_uid AND document_slug = p_slugs[i] AND version = p_versions[i]
    ) THEN
      INSERT INTO public.legal_acceptances(user_id, document_slug, version, context, age_confirmed)
      VALUES (v_uid, p_slugs[i], p_versions[i], p_context, p_age_confirmed);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 25.6 Which documents does a user still need to accept? -------
CREATE OR REPLACE FUNCTION public.get_required_legal_docs(p_user UUID)
RETURNS TABLE (slug TEXT, title_ar TEXT, accepted_version INT, current_version INT, requires_reacceptance BOOLEAN) AS $$
DECLARE v_user UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_user := COALESCE(p_user, auth.uid());
  IF v_user <> auth.uid() AND NOT public.has_role('admin') THEN
    v_user := auth.uid();
  END IF;
  RETURN QUERY
    SELECT d.slug, d.title_ar,
      (SELECT a.version FROM public.legal_acceptances a
        WHERE a.user_id = v_user AND a.document_slug = d.slug
        ORDER BY a.version DESC, a.accepted_at DESC LIMIT 1),
      d.current_version, d.requires_reacceptance
    FROM public.legal_documents d
    WHERE d.status = 'published' AND d.requires_reacceptance
      AND d.slug IN ('terms-of-service','privacy-policy','responsible-disclosure')
      AND (
        d.current_version IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.legal_acceptances a2
           WHERE a2.user_id = v_user AND a2.document_slug = d.slug AND a2.version >= d.current_version
        )
      );
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
