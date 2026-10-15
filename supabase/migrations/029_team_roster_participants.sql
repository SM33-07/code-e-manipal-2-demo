-- Migration 029: Team Roster Participants Extension
-- Allows team_members to store non-login participant roster entries alongside the leader.

-- 1. Ensure columns exist on public.team_members
DO $$
BEGIN
  -- Add id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN id UUID DEFAULT gen_random_uuid();
  END IF;

  -- Add participant profile columns if not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'college'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN college TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'study_year'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN study_year TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. Drop the composite primary key (team_id, user_id) and make id the primary key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'team_members' AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'team_members_pkey'
  ) THEN
    -- Check if composite
    IF (SELECT count(*) FROM information_schema.key_column_usage WHERE constraint_name = 'team_members_pkey') > 1 THEN
      ALTER TABLE public.team_members DROP CONSTRAINT team_members_pkey;
      UPDATE public.team_members SET id = gen_random_uuid() WHERE id IS NULL;
      ALTER TABLE public.team_members ALTER COLUMN id SET NOT NULL;
      ALTER TABLE public.team_members ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);
    END IF;
  END IF;
END $$;

-- 3. Relax user_id not-null requirement for non-auth roster participants
ALTER TABLE public.team_members ALTER COLUMN user_id DROP NOT NULL;

-- 4. Idempotency unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_email_idx 
  ON public.team_members(team_id, LOWER(TRIM(email))) 
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_idx 
  ON public.team_members(team_id, user_id) 
  WHERE user_id IS NOT NULL;
