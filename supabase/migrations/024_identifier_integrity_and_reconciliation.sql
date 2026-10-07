BEGIN;

-- Participants authenticate only with their canonical TEAM-XXX identifier.
UPDATE public.profiles
SET login_id = NULL
WHERE role = 'participant';

-- Repair already-existing judge/admin login IDs against the shared identifier namespace.
DO $$
DECLARE
  account RECORD;
  token TEXT;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('code-e-manipal-cross-column-identifiers'));

  FOR account IN
    SELECT id, role, name, login_id
    FROM public.profiles
    WHERE role IN ('judge', 'admin')
      AND (
        login_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.profiles other
          WHERE other.id <> public.profiles.id
            AND (UPPER(BTRIM(other.identifier)) = UPPER(BTRIM(public.profiles.login_id))
              OR UPPER(BTRIM(other.login_id)) = UPPER(BTRIM(public.profiles.login_id)))
        )
      )
    ORDER BY created_at, id
  LOOP
    token := NULLIF(REGEXP_REPLACE(UPPER(SPLIT_PART(BTRIM(COALESCE(account.name, '')), ' ', 1)), '[^A-Z0-9]+', '', 'g'), '');
    candidate := UPPER(account.role) || '-' || COALESCE(token, 'USER');
    suffix := 2;

    WHILE EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id <> account.id
        AND (UPPER(BTRIM(p.identifier)) = candidate OR UPPER(BTRIM(p.login_id)) = candidate)
    ) LOOP
      candidate := UPPER(account.role) || '-' || COALESCE(token, 'USER') || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;

    UPDATE public.profiles SET login_id = candidate WHERE id = account.id;
  END LOOP;
END $$;

-- Keep the non-authoritative Auth metadata mirror aligned with repaired profiles.
UPDATE auth.users au
SET raw_user_meta_data = jsonb_set(
  COALESCE(au.raw_user_meta_data, '{}'::jsonb),
  '{login_id}',
  to_jsonb(p.login_id),
  true
)
FROM public.profiles p
WHERE au.id = p.id
  AND p.role IN ('judge', 'admin')
  AND p.login_id IS NOT NULL;

UPDATE auth.users au
SET raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb) - 'login_id'
FROM public.profiles p
WHERE au.id = p.id
  AND p.role = 'participant';

-- Do not invent replacements for malformed legacy canonical identifiers.
DO $$
DECLARE
  malformed TEXT;
BEGIN
  SELECT string_agg(
    format('%s:%s', role, COALESCE(identifier, '<NULL>')),
    ', ' ORDER BY role, identifier
  )
  INTO malformed
  FROM public.profiles
  WHERE (role = 'participant' AND (identifier IS NULL OR identifier !~ '^TEAM-[0-9]{3}$'))
     OR (role = 'judge' AND (identifier IS NULL OR identifier !~ '^JUDGE-[0-9]{2}$'))
     OR (role = 'admin' AND (identifier IS NULL OR identifier !~ '^ADMIN-[0-9]{2}$'));

  IF malformed IS NOT NULL THEN
    RAISE EXCEPTION 'Malformed canonical profile identifiers require deliberate reconciliation: %', malformed
      USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_profile_identifier_namespace()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('code-e-manipal-cross-column-identifiers'));

  IF NEW.role = 'participant' THEN
    IF NEW.identifier IS NULL OR NEW.identifier !~ '^TEAM-[0-9]{3}$' THEN
      RAISE EXCEPTION 'participant profiles must use a TEAM-XXX identifier'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.login_id IS NOT NULL THEN
      RAISE EXCEPTION 'participant profiles must have login_id = NULL'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.role = 'judge' THEN
    IF NEW.identifier IS NULL OR NEW.identifier !~ '^JUDGE-[0-9]{2}$' THEN
      RAISE EXCEPTION 'judge profiles must use a JUDGE-XX identifier'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.login_id IS NULL THEN
      RAISE EXCEPTION 'judge profiles must have a personalized login_id'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.role = 'admin' THEN
    IF NEW.identifier IS NULL OR NEW.identifier !~ '^ADMIN-[0-9]{2}$' THEN
      RAISE EXCEPTION 'admin profiles must use an ADMIN-XX identifier'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.login_id IS NULL THEN
      RAISE EXCEPTION 'admin profiles must have a personalized login_id'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.identifier IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IS DISTINCT FROM NEW.id
      AND (UPPER(BTRIM(p.identifier)) = UPPER(BTRIM(NEW.identifier))
        OR UPPER(BTRIM(p.login_id)) = UPPER(BTRIM(NEW.identifier)))
  ) THEN
    RAISE EXCEPTION 'profile identifier collides with an existing identifier or login_id'
      USING ERRCODE = '23505';
  END IF;

  IF NEW.login_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IS DISTINCT FROM NEW.id
      AND (UPPER(BTRIM(p.identifier)) = UPPER(BTRIM(NEW.login_id))
        OR UPPER(BTRIM(p.login_id)) = UPPER(BTRIM(NEW.login_id)))
  ) THEN
    RAISE EXCEPTION 'profile login_id collides with an existing identifier or login_id'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_identifier_namespace_trigger ON public.profiles;
CREATE TRIGGER profiles_identifier_namespace_trigger
BEFORE INSERT OR UPDATE OF role, identifier, login_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_identifier_namespace();

DO $$
DECLARE
  table_exists BOOLEAN;
  row_count BIGINT;
  missing_column TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'provisioning_reconciliation'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE public.provisioning_reconciliation (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_id UUID NOT NULL UNIQUE,
      auth_user_id UUID NOT NULL,
      profile_id UUID,
      stage TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PENDING_AUTH_CLEANUP', 'AUTH_CLEANUP_RESOLVED', 'MANUAL_REVIEW')),
      error_message TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
  ELSE
    SELECT COUNT(*) INTO row_count FROM public.provisioning_reconciliation;
    FOREACH missing_column IN ARRAY ARRAY['id', 'operation_id', 'auth_user_id', 'profile_id', 'stage', 'status', 'error_message', 'retry_count', 'created_at', 'resolved_at'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'provisioning_reconciliation' AND column_name = missing_column
      ) THEN
        IF row_count > 0 THEN
          RAISE EXCEPTION 'Existing public.provisioning_reconciliation is incompatible: missing required column %', missing_column;
        END IF;
        IF missing_column = 'id' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN id UUID DEFAULT gen_random_uuid();
        ELSIF missing_column = 'operation_id' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN operation_id UUID;
        ELSIF missing_column = 'auth_user_id' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN auth_user_id UUID;
        ELSIF missing_column = 'profile_id' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN profile_id UUID;
        ELSIF missing_column = 'stage' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN stage TEXT;
        ELSIF missing_column = 'status' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN status TEXT;
        ELSIF missing_column = 'error_message' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN error_message TEXT;
        ELSIF missing_column = 'retry_count' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN retry_count INTEGER DEFAULT 0;
        ELSIF missing_column = 'created_at' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        ELSIF missing_column = 'resolved_at' THEN ALTER TABLE public.provisioning_reconciliation ADD COLUMN resolved_at TIMESTAMPTZ;
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  column_name TEXT;
  expected_type TEXT;
  actual_type TEXT;
  nullable_state TEXT;
BEGIN
  FOR column_name, expected_type IN
    SELECT * FROM (VALUES
      ('id', 'uuid'), ('operation_id', 'uuid'), ('auth_user_id', 'uuid'),
      ('profile_id', 'uuid'), ('stage', 'text'), ('status', 'text'),
      ('error_message', 'text'), ('retry_count', 'int4'),
      ('created_at', 'timestamptz'), ('resolved_at', 'timestamptz')
    ) AS expected(column_name, expected_type)
  LOOP
    SELECT c.udt_name, c.is_nullable INTO actual_type, nullable_state
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'provisioning_reconciliation'
      AND c.column_name = column_name;
    IF actual_type IS DISTINCT FROM expected_type THEN
      RAISE EXCEPTION 'Existing public.provisioning_reconciliation is incompatible: column % has type %, expected %', column_name, actual_type, expected_type;
    END IF;
    IF column_name IN ('id', 'operation_id', 'auth_user_id', 'stage', 'status', 'error_message', 'created_at')
       AND nullable_state = 'YES' THEN
      RAISE EXCEPTION 'Existing public.provisioning_reconciliation is incompatible: required column % is nullable', column_name;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.provisioning_reconciliation'::regclass
      AND contype = 'c'
      AND conname = 'provisioning_reconciliation_status_check'
  ) THEN
    ALTER TABLE public.provisioning_reconciliation
      ADD CONSTRAINT provisioning_reconciliation_status_check
      CHECK (status IN ('PENDING_AUTH_CLEANUP', 'AUTH_CLEANUP_RESOLVED', 'MANUAL_REVIEW'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_provisioning_reconciliation_status
  ON public.provisioning_reconciliation(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provisioning_reconciliation_operation_unique
  ON public.provisioning_reconciliation(operation_id);

COMMIT;
