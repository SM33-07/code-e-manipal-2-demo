import fs from 'fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    let val = v.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[k.trim()] = val;
  }
});

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute || process.argv.includes('--dry-run');
const syncAllTen = process.argv.includes('--all-ten');

const OPERATIONAL_ROSTER = ['judge1', 'judge2', 'judge3', 'judge4', 'judge5'];

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║   Code-e-Manipal 2.0 — Sync Authoritative Judge Profiles to Supabase ║');
console.log(`║   Mode: ${isDryRun ? 'DRY-RUN (Read-Only Preview)' : 'EXECUTE (Live Sync)'}`.padEnd(71) + '║');
console.log(`║   Scope: ${syncAllTen ? 'ALL 10 ACTIVE JUDGES' : 'OPERATIONAL ROSTER (5 JUDGES)'}`.padEnd(71) + '║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sbAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const sbAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

async function main() {
  // 1. Query authoritative active judges from Azure PostgreSQL
  const { rows: azureJudgesAll } = await pool.query(`
    SELECT id, name, email, role, identifier, login_id, is_disabled
    FROM public.profiles
    WHERE role = 'judge' AND is_disabled = false
    ORDER BY login_id
  `);

  const azureJudges = syncAllTen
    ? azureJudgesAll
    : azureJudgesAll.filter(j => OPERATIONAL_ROSTER.includes(j.login_id));

  console.log(`Found ${azureJudgesAll.length} active judge accounts in Azure PostgreSQL.`);
  console.log(`Selected ${azureJudges.length} judge profiles under current scope (${syncAllTen ? 'All 10' : 'Operational 5'}):`);
  azureJudges.forEach(j => {
    console.log(`  - ${j.login_id?.padEnd(10)} | ${j.identifier?.padEnd(10)} | ${j.name?.padEnd(12)} | ${j.id}`);
  });

  if (!syncAllTen) {
    const excluded = azureJudgesAll.filter(j => !OPERATIONAL_ROSTER.includes(j.login_id));
    console.log(`\nExcluded legacy/spare judge accounts (${excluded.length}):`);
    excluded.forEach(j => {
      console.log(`  - ${j.login_id?.padEnd(10)} | ${j.identifier?.padEnd(10)} | ${j.name?.padEnd(12)} | [EXCLUDED FROM SYNC]`);
    });
  }

  // 2. Query existing profiles in Supabase
  const { data: existingSbProfiles, error: fetchErr } = await sbAdmin
    .from('profiles')
    .select('id, name, email, role');

  if (fetchErr) {
    console.error('Failed to fetch existing Supabase profiles:', fetchErr.message);
    process.exit(1);
  }

  const existingMap = new Map((existingSbProfiles || []).map(p => [p.id, p]));
  const missingInSb = azureJudges.filter(j => !existingMap.has(j.id) || existingMap.get(j.id).role !== 'judge');

  console.log(`\nSupabase Profiles Status:`);
  console.log(`  - Total existing rows: ${existingSbProfiles?.length}`);
  console.log(`  - Missing/Unsynced judge profiles: ${missingInSb.length}`);

  if (missingInSb.length === 0) {
    console.log('\nAll active judges are already correctly synchronized in Supabase profiles.');
    await pool.end();
    return;
  }

  console.log('\nProfiles to sync:');
  missingInSb.forEach(j => {
    console.log(`  + [SYNC] ${j.login_id} (${j.identifier}) -> ${j.email} [role: judge]`);
  });

  if (isDryRun) {
    console.log('\n[DRY-RUN COMPLETE] No database mutations were performed.');
    console.log('To execute this synchronization, run with: node scripts/sync-judge-profiles-to-supabase.mjs --execute');
    await pool.end();
    return;
  }

  // 3. Execute live sync
  console.log('\nApplying live synchronization...');
  const payload = missingInSb.map(j => ({
    id: j.id,
    name: j.name,
    email: j.email,
    role: 'judge',
  }));

  const { data: upserted, error: upsertErr } = await sbAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, name, email, role');

  if (upsertErr) {
    console.error('❌ Failed to upsert profiles into Supabase:', upsertErr.message);
    process.exit(1);
  }

  console.log(`✅ Successfully synced ${upserted?.length} judge profiles into Supabase PostgREST profiles table.`);

  // 4. Verify post-sync via anon client (simulating proxy.ts query)
  console.log('\nVerifying via Supabase Anon Client (simulating proxy.ts):');
  for (const j of missingInSb) {
    const { data: verifyProf, error: vErr } = await sbAnon
      .from('profiles')
      .select('role')
      .eq('id', j.id)
      .maybeSingle();

    if (vErr || !verifyProf || verifyProf.role !== 'judge') {
      console.error(`  ❌ Verification failed for ${j.login_id}:`, vErr?.message || verifyProf);
    } else {
      console.log(`  ✓ ${j.login_id} (${j.identifier}): role = '${verifyProf.role}' resolved via proxy query`);
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
