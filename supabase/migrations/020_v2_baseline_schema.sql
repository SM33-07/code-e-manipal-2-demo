-- ============================================================
-- CODE-e-MANIPAL 2.0 — PHASE 1 RECONCILED BASELINE MIGRATION
-- File: supabase/migrations/020_v2_baseline_schema.sql
-- Target: Azure PostgreSQL (Production) / Local Staging
-- Policy: Fully non-destructive, staged backfills, zero data loss
-- ============================================================

BEGIN;

-- ============================================================
-- 1. TEAMS EXTENSIONS
-- ============================================================
-- Add track column for multi-track hackathon evaluation
ALTER TABLE public.teams 
  ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'General';

-- ============================================================
-- 2. PROFILES EXTENSIONS & STAGED BACKFILL
-- ============================================================
-- Add canonical session lifecycle and identification fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identifier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS force_logout_before TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Staged Backfill for Existing 12 Profiles:
-- Generate canonical identifiers for existing profiles without collision
WITH ranked_participants AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS seq
  FROM public.profiles
  WHERE role = 'participant' AND (identifier IS NULL OR identifier = '')
)
UPDATE public.profiles p
SET identifier = 'TEAM-' || LPAD(rp.seq::text, 3, '0')
FROM ranked_participants rp
WHERE p.id = rp.id;

WITH ranked_judges AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS seq
  FROM public.profiles
  WHERE role = 'judge' AND (identifier IS NULL OR identifier = '')
)
UPDATE public.profiles p
SET identifier = 'JUDGE-' || LPAD(rj.seq::text, 2, '0')
FROM ranked_judges rj
WHERE p.id = rj.id;

WITH ranked_admins AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS seq
  FROM public.profiles
  WHERE role = 'admin' AND (identifier IS NULL OR identifier = '')
)
UPDATE public.profiles p
SET identifier = 'ADMIN-' || LPAD(ra.seq::text, 2, '0')
FROM ranked_admins ra
WHERE p.id = ra.id;

-- Staged Backfill for profiles.team_id:
-- STRICT INVARIANT: Only link team_id if a valid team_members record exists for a participant.
-- Non-member participants, judges, and admins must remain NULL.
UPDATE public.profiles p
SET team_id = tm.team_id
FROM public.team_members tm
WHERE p.id = tm.user_id AND p.role = 'participant' AND p.team_id IS NULL;

-- Fallback for any unassigned profile identifier
UPDATE public.profiles
SET identifier = 'USER-' || SUBSTRING(id::text, 1, 8)
WHERE identifier IS NULL OR identifier = '';

-- Apply NOT NULL and Case-Insensitive Unique Index on identifier
ALTER TABLE public.profiles ALTER COLUMN identifier SET NOT NULL;

DROP INDEX IF EXISTS public.idx_profiles_identifier_unique;
CREATE UNIQUE INDEX idx_profiles_identifier_unique 
  ON public.profiles (UPPER(TRIM(identifier)));

DROP INDEX IF EXISTS public.idx_profiles_role;
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================================
-- 3. SUBMISSIONS EXTENSIONS & FINALIZATION LOCKING
-- ============================================================
-- Add final submission timestamp and lock flag
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS final_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- Enforce exactly one canonical submission per team
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idx_submissions_team_id_unique'
  ) THEN
    ALTER TABLE public.submissions 
      ADD CONSTRAINT idx_submissions_team_id_unique UNIQUE (team_id);
  END IF;
END $$;

-- Update status check constraint to include 'locked'
ALTER TABLE public.submissions 
  DROP CONSTRAINT IF EXISTS submissions_status_check;

ALTER TABLE public.submissions 
  ADD CONSTRAINT submissions_status_check 
  CHECK (status IN ('draft', 'submitted', 'locked', 'under_review', 'reviewed'));

-- ============================================================
-- 4. JUDGE REVIEWS VERSIONING & CONCURRENCY
-- ============================================================
-- Add optimistic concurrency version to existing judge_reviews table
ALTER TABLE public.judge_reviews
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- Create review_history table for immutable score change audits (ADR-005)
CREATE TABLE IF NOT EXISTS public.review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.judge_reviews(id) ON DELETE RESTRICT,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE RESTRICT,
  judge_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  round VARCHAR(50) NOT NULL DEFAULT '1',
  version INT NOT NULL,
  previous_scores JSONB NOT NULL,
  previous_feedback TEXT,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL
);

DROP INDEX IF EXISTS public.idx_review_history_submission;
CREATE INDEX idx_review_history_submission ON public.review_history(submission_id);

DROP INDEX IF EXISTS public.idx_review_history_review;
CREATE INDEX idx_review_history_review ON public.review_history(review_id);

-- ============================================================
-- 5. RESULTS ARCHITECTURE: SNAPSHOT & AWARDS TABLES (ADR-011)
-- ============================================================
-- Write-once mathematical ranking generated atomically upon clicking Publish
CREATE TABLE IF NOT EXISTS public.results_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID UNIQUE NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
);

-- Separate ceremony award overlay table (editable strictly during PUBLISHING buffer)
CREATE TABLE IF NOT EXISTS public.results_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID UNIQUE NOT NULL REFERENCES public.results_snapshot(release_id) ON DELETE RESTRICT,
  award_overlay JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
);

-- ============================================================
-- 6. EVENT CONFIGURATION: STRUCTURED SINGLETON RECONCILIATION
-- ============================================================
-- Preserve existing key-value event_config table by renaming to event_config_kv
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'event_config'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'event_config' AND column_name = 'event_phase'
  ) THEN
    ALTER TABLE public.event_config RENAME TO event_config_kv;
  END IF;
END $$;

-- Create the structured singleton event_config table with database-level constraints
CREATE TABLE IF NOT EXISTS public.event_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  event_phase VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (event_phase IN ('NOT_STARTED', 'HACKING', 'SUBMISSION', 'SUBMISSION_CLOSED', 'JUDGING', 'RESULTS', 'ENDED')),
  results_release VARCHAR(50) NOT NULL DEFAULT 'DRAFT'
    CHECK (results_release IN ('DRAFT', 'PUBLISHING', 'PUBLISHED')),
  publish_at TIMESTAMPTZ NULL,
  buffer_minutes INT NOT NULL DEFAULT 5 
    CHECK (buffer_minutes BETWEEN 1 AND 60),
  active_release_id UUID NULL 
    REFERENCES public.results_snapshot(release_id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NULL,
  end_time TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_publishing_publish_at 
    CHECK (results_release != 'PUBLISHING' OR publish_at IS NOT NULL)
);

-- Backfill initial state into structured event_config from event_config_kv if present
DO $$
DECLARE
  v_started TEXT := 'false';
  v_start_time TEXT := NULL;
  v_published TEXT := 'false';
  v_phase VARCHAR(50) := 'NOT_STARTED';
  v_release VARCHAR(50) := 'DRAFT';
  v_parsed_start TIMESTAMPTZ := NULL;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_config_kv') THEN
    SELECT value INTO v_started FROM public.event_config_kv WHERE key = 'hackathon_is_started';
    SELECT value INTO v_start_time FROM public.event_config_kv WHERE key = 'hackathon_start_time';
    SELECT value INTO v_published FROM public.event_config_kv WHERE key = 'results_published';
    
    IF v_started = 'true' THEN
      v_phase := 'HACKING';
    END IF;

    IF v_published = 'true' THEN
      v_release := 'PUBLISHED';
    END IF;

    IF v_start_time IS NOT NULL AND v_start_time != '' THEN
      BEGIN
        v_parsed_start := v_start_time::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        v_parsed_start := NULL;
      END;
    END IF;
  END IF;

  INSERT INTO public.event_config (
    id, event_phase, results_release, buffer_minutes, start_time, updated_at
  ) VALUES (
    1, v_phase, v_release, 5, v_parsed_start, NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    event_phase = EXCLUDED.event_phase,
    results_release = EXCLUDED.results_release,
    updated_at = NOW();
END $$;

-- Backward-compatibility view for any external tools or legacy scripts
CREATE OR REPLACE VIEW public.event_config_legacy_view AS
SELECT 'event_phase' AS key, event_phase::text AS value, updated_at FROM public.event_config
UNION ALL
SELECT 'results_release' AS key, results_release::text AS value, updated_at FROM public.event_config
UNION ALL
SELECT 'hackathon_is_started' AS key, (event_phase != 'NOT_STARTED')::text AS value, updated_at FROM public.event_config
UNION ALL
SELECT 'results_published' AS key, (results_release = 'PUBLISHED')::text AS value, updated_at FROM public.event_config
UNION ALL
SELECT 'hackathon_start_time' AS key, COALESCE(start_time::text, '') AS value, updated_at FROM public.event_config
UNION ALL
SELECT 'hackathon_duration_hours' AS key, '48' AS value, updated_at FROM public.event_config;

-- ============================================================
-- 7. AUDIT LOGS & LOGIN ATTEMPTS (PRIVACY-MINIMIZED TELEMETRY)
-- ============================================================
-- Audit logs (Append-only application security log; NO raw IP or raw user-agent)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash VARCHAR(16),
  user_agent_summary VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

DROP INDEX IF EXISTS public.idx_audit_logs_action;
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

DROP INDEX IF EXISTS public.idx_audit_logs_user_id;
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Login attempts for rate limiting and forensic correlation (ADR-008)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_key TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  ip_hash VARCHAR(16) NOT NULL,
  user_agent_summary VARCHAR(64)
);

DROP INDEX IF EXISTS public.idx_login_attempts_identity_time;
CREATE INDEX idx_login_attempts_identity_time 
  ON public.login_attempts(identity_key, attempted_at DESC);

DROP INDEX IF EXISTS public.idx_login_attempts_attempted_at;
CREATE INDEX idx_login_attempts_attempted_at 
  ON public.login_attempts(attempted_at);

COMMIT;
