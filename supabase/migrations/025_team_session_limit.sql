-- ============================================================
-- CODE-e-MANIPAL 2.0 — PHASE 1 TEAM SESSION ENFORCEMENT MIGRATION
-- File: supabase/migrations/025_team_session_limit.sql
-- Target: Azure PostgreSQL (Production / Staging)
-- Invariants:
--   - Non-destructive, idempotent
--   - Atomic server-side team session tracking
--   - Fast indexed lookups for active team sessions
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.team_active_sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_hash VARCHAR(64) NOT NULL,
  user_agent_summary VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_team_active_sessions_team_active
  ON public.team_active_sessions(team_id, is_revoked, expires_at);

CREATE INDEX IF NOT EXISTS idx_team_active_sessions_user
  ON public.team_active_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_team_active_sessions_expiry
  ON public.team_active_sessions(expires_at);

COMMIT;
