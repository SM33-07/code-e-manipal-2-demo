import { Client } from 'pg';

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const res = await pg.query(
    "UPDATE public.profiles SET is_disabled = true, force_logout_before = NOW(), updated_at = NOW() WHERE id = '3f93c481-5209-4223-a6d6-e8ac762fa372' RETURNING id, identifier, email, is_disabled"
  );
  console.log('JUDGE-01 decommissioned on staging:', res.rows[0]);
  await pg.end();
}

main().catch(console.error);
