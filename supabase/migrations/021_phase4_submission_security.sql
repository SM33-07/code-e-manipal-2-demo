-- ============================================================
-- CODE-e-MANIPAL 2.0 — PHASE 4 SUBMISSION SECURITY MIGRATION
-- File: supabase/migrations/021_phase4_submission_security.sql
-- Target: Azure PostgreSQL (Production) / Local Staging
-- Policy: Fully non-destructive, zero data loss
-- ============================================================

BEGIN;

-- Add emergency post-deadline override audit fields to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS emergency_override_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emergency_override_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emergency_override_reason TEXT;

COMMIT;
