BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_id VARCHAR(80);

DO $$
DECLARE
  account RECORD;
  name_token TEXT;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR account IN
    SELECT id, role, name
    FROM public.profiles
    WHERE role IN ('judge', 'admin') AND login_id IS NULL
    ORDER BY created_at, id
  LOOP
    name_token := NULLIF(
      REGEXP_REPLACE(UPPER(SPLIT_PART(BTRIM(COALESCE(account.name, '')), ' ', 1)), '[^A-Z0-9]+', '', 'g'),
      ''
    );
    candidate := UPPER(account.role) || '-' || COALESCE(name_token, 'USER');
    suffix := 2;

    WHILE EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id <> account.id AND UPPER(BTRIM(p.login_id)) = candidate
    ) LOOP
      candidate := UPPER(account.role) || '-' || COALESCE(name_token, 'USER') || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;

    UPDATE public.profiles SET login_id = candidate WHERE id = account.id;
  END LOOP;

  UPDATE public.profiles
  SET login_id = identifier
  WHERE role = 'participant'
    AND login_id IS NULL
    AND identifier ~ '^TEAM-[0-9]{3}$';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_login_id_unique
  ON public.profiles (UPPER(BTRIM(login_id)))
  WHERE login_id IS NOT NULL;

COMMIT;
