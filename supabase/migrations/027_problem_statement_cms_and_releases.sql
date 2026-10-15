-- ============================================================
-- CODE-e-MANIPAL 2.0 — PHASE 3 PROBLEM STATEMENT CMS & RELEASES
-- File: supabase/migrations/027_problem_statement_cms_and_releases.sql
-- Target: Azure PostgreSQL (Production / Staging)
-- Invariants:
--   - Versioned releases with explicit published release pointer
--   - Strict isolation of drafts, held items, and proposals
--   - Single atomic publication transaction
--   - Comprehensive audit trail
-- ============================================================

BEGIN;

-- 1. Problem Statement Releases Table
CREATE TABLE IF NOT EXISTS public.problem_statement_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'withdrawn')),
  is_current_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  release_notes TEXT
);

-- At most ONE release can be currently published at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_current_published_release 
  ON public.problem_statement_releases (is_current_published) 
  WHERE is_current_published = TRUE;

CREATE INDEX IF NOT EXISTS idx_ps_releases_status 
  ON public.problem_statement_releases (status, is_current_published);

-- 2. Problem Statement Drafts & Version-Scoped Items Table
CREATE TABLE IF NOT EXISTS public.problem_statement_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES public.problem_statement_releases(id) ON DELETE CASCADE,
  challenge_num INTEGER NOT NULL,
  track_num VARCHAR(10) NOT NULL,
  track VARCHAR(100) NOT NULL,
  original_ref_id VARCHAR(50) NOT NULL,
  proposed_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  difficulty VARCHAR(50) NOT NULL DEFAULT 'Advanced',
  build_type VARCHAR(100) NOT NULL DEFAULT 'Software',
  review_status VARCHAR(100) NOT NULL DEFAULT 'SELECTED FOR FURTHER REVIEW',
  category_state VARCHAR(20) NOT NULL DEFAULT 'selected' CHECK (category_state IN ('selected', 'hold', 'new_proposal')),
  is_approved_for_release BOOLEAN NOT NULL DEFAULT FALSE,
  is_official_sih BOOLEAN NOT NULL DEFAULT FALSE,
  scope_note TEXT,
  problem_statement TEXT NOT NULL,
  implementation_challenge TEXT NOT NULL,
  minimum_acceptable_prototype TEXT NOT NULL,
  evaluation_tests TEXT NOT NULL,
  stretch_differentiator TEXT NOT NULL,
  suggested_public_sector_relevance TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_release_proposed_id UNIQUE (release_id, proposed_id)
);

CREATE INDEX IF NOT EXISTS idx_ps_drafts_release_approved 
  ON public.problem_statement_drafts (release_id, is_approved_for_release, display_order);

CREATE INDEX IF NOT EXISTS idx_ps_drafts_track 
  ON public.problem_statement_drafts (track, category_state);

CREATE INDEX IF NOT EXISTS idx_ps_drafts_proposed_id 
  ON public.problem_statement_drafts (proposed_id);

-- 3. Audit Log for CMS and Releases
CREATE TABLE IF NOT EXISTS public.problem_statement_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  release_id UUID REFERENCES public.problem_statement_releases(id) ON DELETE SET NULL,
  draft_id UUID,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ps_audit_created 
  ON public.problem_statement_audit_logs (created_at DESC);

-- 4. Extend event_config with active_problem_release_id
ALTER TABLE public.event_config 
  ADD COLUMN IF NOT EXISTS active_problem_release_id UUID REFERENCES public.problem_statement_releases(id) ON DELETE SET NULL;

-- 5. Row Level Security Policies
ALTER TABLE public.problem_statement_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statement_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statement_audit_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Public can view published release" ON public.problem_statement_releases;
DROP POLICY IF EXISTS "Public can view approved statements of published release" ON public.problem_statement_drafts;
DROP POLICY IF EXISTS "Admins have full access to releases" ON public.problem_statement_releases;
DROP POLICY IF EXISTS "Admins have full access to drafts" ON public.problem_statement_drafts;
DROP POLICY IF EXISTS "Admins have full access to audit logs" ON public.problem_statement_audit_logs;

-- Public read access: ONLY current published release
CREATE POLICY "Public can view published release" 
  ON public.problem_statement_releases
  FOR SELECT
  USING (is_current_published = TRUE AND status = 'published');

-- Public read access: ONLY approved items belonging to the current published release
CREATE POLICY "Public can view approved statements of published release" 
  ON public.problem_statement_drafts
  FOR SELECT
  USING (
    is_approved_for_release = TRUE AND
    release_id IN (
      SELECT id FROM public.problem_statement_releases 
      WHERE is_current_published = TRUE AND status = 'published'
    )
  );

COMMIT;
