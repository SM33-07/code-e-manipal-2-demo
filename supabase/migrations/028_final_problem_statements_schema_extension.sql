-- ============================================================
-- CODE-e-MANIPAL 2.0 — PROBLEM STATEMENTS SCHEMA EXTENSION
-- File: supabase/migrations/028_final_problem_statements_schema_extension.sql
-- Target: Azure PostgreSQL (Staging / Production)
-- Purpose: Support structured bullets, slug, and deliverables
-- ============================================================

BEGIN;

ALTER TABLE public.problem_statement_drafts
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description_implementation TEXT,
  ADD COLUMN IF NOT EXISTS deliverables TEXT,
  ADD COLUMN IF NOT EXISTS description_bullets JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deliverables_bullets JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_guidance JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ps_drafts_slug 
  ON public.problem_statement_drafts (slug);

COMMIT;
