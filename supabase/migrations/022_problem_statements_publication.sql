-- Explicit, independent release gate for public challenge content.
-- Default false ensures existing installations remain sealed until an admin acts.
ALTER TABLE public.event_config
  ADD COLUMN IF NOT EXISTS problem_statements_published BOOLEAN NOT NULL DEFAULT FALSE;
