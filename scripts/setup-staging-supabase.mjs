import pg from 'pg';

const stagingDatabaseUrl = process.env.STAGING_DATABASE_URL;

if (!stagingDatabaseUrl) {
  console.error('❌ Configuration error: STAGING_DATABASE_URL environment variable is required.');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(stagingDatabaseUrl);
} catch {
  console.error('❌ Configuration error: STAGING_DATABASE_URL must be a valid connection URL.');
  process.exit(1);
}

if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
  console.error('❌ Configuration error: STAGING_DATABASE_URL must be a PostgreSQL connection URL.');
  process.exit(1);
}

if (process.env.DATABASE_URL && stagingDatabaseUrl === process.env.DATABASE_URL) {
  console.error('❌ Safety violation: STAGING_DATABASE_URL matches production DATABASE_URL. Operation blocked.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: stagingDatabaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function setup() {
  console.log('Connecting to Supabase Staging PG...');
  await client.connect();

  console.log('Creating public.profiles schema and trigger in Supabase Staging...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT DEFAULT '',
      email TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'participant',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      INSERT INTO public.profiles (id, name, email, avatar_url, role)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_user_meta_data->>'role', 'participant')
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();

    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
    CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
    CREATE POLICY "profiles_all" ON public.profiles FOR ALL USING (true);
  `);

  console.log('✅ Supabase Staging schema & trigger initialized successfully!');
  await client.end();
}

setup().catch(err => {
  console.error('❌ Failed setting up Supabase staging:', err);
  process.exit(1);
});
