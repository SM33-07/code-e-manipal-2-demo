-- ============================================================
-- CODE-e-MANIPAL 2.0 — Migration 030: Submission Window Controls
-- File: supabase/migrations/030_submission_window_controls.sql
-- Target: Azure PostgreSQL (Production / Staging)
-- Invariants:
--   - Non-destructive, idempotent
--   - Adds allow_deadline_override to public.event_config
-- ============================================================

ALTER TABLE public.event_config
  ADD COLUMN IF NOT EXISTS allow_deadline_override BOOLEAN NOT NULL DEFAULT FALSE;
