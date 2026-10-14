-- ============================================================
-- CODE-e-MANIPAL 2.0 — PHASE 2 CANONICAL EVENT SCHEDULER & REAL-TIME OPERATIONS
-- File: supabase/migrations/026_canonical_scheduler_and_operations.sql
-- Target: Azure PostgreSQL (Staging / Production)
-- Invariants:
--   - Non-destructive, idempotent
--   - Canonical timestamp fields for automatic state transitions
--   - Global freeze & submission gating controls
--   - Idempotent announcements and per-user notification receipts
-- ============================================================

BEGIN;

-- 1. Extend public.timeline_events with canonical timestamps & operational config
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS start_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS opens_submissions BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS closes_submissions BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_offsets_minutes INT[] DEFAULT ARRAY[60, 15];

-- Index for timeline active queries and transitions
CREATE INDEX IF NOT EXISTS idx_timeline_events_timestamps
  ON public.timeline_events(start_timestamp, end_timestamp)
  WHERE is_published = TRUE;

CREATE INDEX IF NOT EXISTS idx_timeline_events_display_order
  ON public.timeline_events(display_order ASC);

-- 2. Extend public.event_config with global freeze & scheduler tracking
ALTER TABLE public.event_config
  ADD COLUMN IF NOT EXISTS global_freeze BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submission_open BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_scheduler_tick TIMESTAMPTZ DEFAULT NULL;

-- 3. Extend public.announcements with idempotency & event linkage
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) UNIQUE,
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.timeline_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_url VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_announcements_idempotency
  ON public.announcements(idempotency_key);

-- 4. Create public.user_notification_receipts for per-user unread tracking
CREATE TABLE IF NOT EXISTS public.user_notification_receipts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID         NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ  DEFAULT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notification_receipts_lookup
  ON public.user_notification_receipts(user_id, is_read, created_at DESC);

-- Enable RLS on receipts
ALTER TABLE public.user_notification_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS receipts_user_select ON public.user_notification_receipts;
  DROP POLICY IF EXISTS receipts_user_insert ON public.user_notification_receipts;
  DROP POLICY IF EXISTS receipts_user_update ON public.user_notification_receipts;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY receipts_user_select ON public.user_notification_receipts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY receipts_user_insert ON public.user_notification_receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY receipts_user_update ON public.user_notification_receipts
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Canonical initial timeline alignment (10 events from authoritative UPDATED TIMELINE.pdf)
-- Ensure all 10 events exist with exact titles, venues, order and IST timestamps

-- Event 1: Registration Open
UPDATE public.timeline_events
SET title = 'Registration Open',
    day_label = 'DAY 1',
    time_range = '9:00 AM – 11:00 AM',
    start_time = '9:00 AM',
    end_time = '11:00 AM',
    start_timestamp = '2026-10-15T09:00:00+05:30',
    end_timestamp = '2026-10-15T11:00:00+05:30',
    venue = 'AB1',
    card_position = 'right',
    display_order = 1,
    event_type = 'hospitality',
    is_published = TRUE
WHERE display_order = 1;

-- Event 2: Opening Ceremony
UPDATE public.timeline_events
SET title = 'Opening Ceremony',
    day_label = 'DAY 1',
    time_range = '11:00 AM – 1:00 PM',
    start_time = '11:00 AM',
    end_time = '1:00 PM',
    start_timestamp = '2026-10-15T11:00:00+05:30',
    end_timestamp = '2026-10-15T13:00:00+05:30',
    venue = 'Vasanti Pai',
    card_position = 'left',
    display_order = 2,
    event_type = 'ceremony',
    is_published = TRUE
WHERE display_order = 2;

-- Event 3: Lunch (Day 1)
UPDATE public.timeline_events
SET title = 'Lunch',
    day_label = 'DAY 1',
    time_range = '1:00 PM – 2:30 PM',
    start_time = '1:00 PM',
    end_time = '2:30 PM',
    start_timestamp = '2026-10-15T13:00:00+05:30',
    end_timestamp = '2026-10-15T14:30:00+05:30',
    venue = 'Old Mess, AB1',
    card_position = 'right',
    display_order = 3,
    event_type = 'hospitality',
    is_published = TRUE
WHERE display_order = 3;

-- Event 4: Project Making (Day 1)
UPDATE public.timeline_events
SET title = 'Project Making',
    day_label = 'DAY 1',
    time_range = '2:00 PM – 7:00 PM',
    start_time = '2:00 PM',
    end_time = '7:00 PM',
    start_timestamp = '2026-10-15T14:00:00+05:30',
    end_timestamp = '2026-10-15T19:00:00+05:30',
    venue = 'AB1',
    description = 'Problem statement closes at 4:00 PM',
    card_position = 'left',
    display_order = 4,
    event_type = 'hack',
    opens_submissions = TRUE,
    is_published = TRUE
WHERE display_order = 4;

-- Event 5: Dinner (Day 1)
UPDATE public.timeline_events
SET title = 'Dinner',
    day_label = 'DAY 1',
    time_range = '8:00 PM – 9:30 PM',
    start_time = '8:00 PM',
    end_time = '9:30 PM',
    start_timestamp = '2026-10-15T20:00:00+05:30',
    end_timestamp = '2026-10-15T21:30:00+05:30',
    venue = 'Old Mess, AB1',
    card_position = 'right',
    display_order = 5,
    event_type = 'hospitality',
    is_published = TRUE
WHERE display_order = 5;

-- Event 6: Judging Round 2 (Day 2)
UPDATE public.timeline_events
SET title = 'Judging Round 2',
    day_label = 'DAY 2',
    time_range = '6:00 AM – 7:30 AM',
    start_time = '6:00 AM',
    end_time = '7:30 AM',
    start_timestamp = '2026-10-16T06:00:00+05:30',
    end_timestamp = '2026-10-16T07:30:00+05:30',
    venue = 'AB1',
    description = 'Results at 7:30 AM',
    card_position = 'left',
    display_order = 6,
    event_type = 'eval',
    is_published = TRUE
WHERE display_order = 6;

-- Event 7: Breakfast (Day 2)
UPDATE public.timeline_events
SET title = 'Breakfast',
    day_label = 'DAY 2',
    time_range = '8:00 AM – 9:30 AM',
    start_time = '8:00 AM',
    end_time = '9:30 AM',
    start_timestamp = '2026-10-16T08:00:00+05:30',
    end_timestamp = '2026-10-16T09:30:00+05:30',
    venue = 'Old Mess, AB1',
    description = NULL,
    card_position = 'right',
    display_order = 7,
    event_type = 'hospitality',
    is_published = TRUE
WHERE display_order = 7;

-- Event 8: Lunch (Day 2) — Insert if missing from 9-row table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE title = 'Lunch' AND day_label = 'DAY 2') THEN
    -- Shift remaining events to make room for order 8
    UPDATE public.timeline_events SET display_order = 10 WHERE display_order = 9;
    UPDATE public.timeline_events SET display_order = 9 WHERE display_order = 8;

    INSERT INTO public.timeline_events (
      id, title, day_label, time_range, start_time, end_time,
      start_timestamp, end_timestamp, venue, description,
      card_position, display_order, event_type, is_published
    ) VALUES (
      gen_random_uuid(), 'Lunch', 'DAY 2', '12:00 PM – 1:00 PM', '12:00 PM', '1:00 PM',
      '2026-10-16T12:00:00+05:30', '2026-10-16T13:00:00+05:30', 'Old Mess, AB1', NULL,
      'right', 8, 'hospitality', TRUE
    );
  ELSE
    UPDATE public.timeline_events
    SET display_order = 8,
        time_range = '12:00 PM – 1:00 PM',
        start_time = '12:00 PM',
        end_time = '1:00 PM',
        start_timestamp = '2026-10-16T12:00:00+05:30',
        end_timestamp = '2026-10-16T13:00:00+05:30',
        venue = 'Old Mess, AB1',
        is_published = TRUE
    WHERE title = 'Lunch' AND day_label = 'DAY 2';
  END IF;
END $$;

-- Event 9: Final Round 3 Judging
UPDATE public.timeline_events
SET title = 'Final Round 3 Judging',
    day_label = 'DAY 2',
    time_range = '1:00 PM – 3:00 PM',
    start_time = '1:00 PM',
    end_time = '3:00 PM',
    start_timestamp = '2026-10-16T13:00:00+05:30',
    end_timestamp = '2026-10-16T15:00:00+05:30',
    venue = 'Vasanti Pai',
    card_position = 'left',
    display_order = 9,
    event_type = 'eval',
    is_published = TRUE
WHERE title = 'Final Round 3 Judging';

-- Event 10: Result & Closing Ceremony
UPDATE public.timeline_events
SET title = 'Result & Closing Ceremony',
    day_label = 'DAY 2',
    time_range = '3:00 PM – 5:00 PM',
    start_time = '3:00 PM',
    end_time = '5:00 PM',
    start_timestamp = '2026-10-16T15:00:00+05:30',
    end_timestamp = '2026-10-16T17:00:00+05:30',
    venue = 'Vasanti Pai',
    card_position = 'right',
    display_order = 10,
    event_type = 'awards',
    is_published = TRUE
WHERE title = 'Result & Closing Ceremony';

COMMIT;
