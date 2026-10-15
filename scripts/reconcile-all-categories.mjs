import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function reconcileAll() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — Three Account Categories Reconciliation Audit     ║');
  console.log('║   Target: Staging (cem_staging / ggmwribwynonpsvsmpyz)                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  // Load all PostgreSQL profiles
  const { rows: profiles } = await pool.query(
    `SELECT id, name, email, role, identifier, login_id, team_id, is_disabled FROM public.profiles ORDER BY role, identifier`
  );

  // Load all Supabase Auth users (up to 1000)
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  console.log(`Loaded ${profiles.length} PostgreSQL profiles and ${users.length} Supabase Auth users.\n`);

  // ── 1. Administrators ──
  console.log('======================================================================');
  console.log('CATEGORY 1: ADMINISTRATORS');
  console.log('======================================================================');
  const expectedAdmins = [
    { loginId: 'abhinav', identifier: 'ADMIN-02', email: 'abhinav.ong@gmail.com' },
    { loginId: 'yash', identifier: 'ADMIN-03', email: 'yashsrivastava3745@gmail.com' },
    { loginId: 'soham', identifier: 'ADMIN-04', email: 'sohammore3312@gmail.com' },
  ];

  for (const exp of expectedAdmins) {
    const prof = profiles.find(p => p.identifier === exp.identifier || p.login_id === exp.loginId);
    const authById = prof ? users.find(u => u.id === prof.id) : null;
    const authByEmail = users.find(u => u.email?.toLowerCase() === exp.email.toLowerCase());

    const status = {
      loginId: exp.loginId,
      identifier: exp.identifier,
      profileFound: !!prof,
      profileId: prof?.id,
      profileEmail: prof?.email,
      role: prof?.role,
      isDisabled: prof?.is_disabled,
      authFoundById: !!authById,
      authFoundByEmail: !!authByEmail,
      uuidMatch: prof && authById && prof.id === authById.id,
      emailMatch: prof && authByEmail && prof.email.toLowerCase() === authByEmail.email.toLowerCase(),
    };
    console.log(status);
  }

  // Obsolete ADMIN-01 audit record check
  const admin01 = profiles.find(p => p.identifier === 'ADMIN-01');
  console.log('\nADMIN-01 audit record preservation:');
  console.log({
    identifier: admin01?.identifier,
    role: admin01?.role,
    isDisabled: admin01?.is_disabled,
    preservedAsDisabled: admin01?.is_disabled === true,
  });

  // ── 2. Judges ──
  console.log('\n======================================================================');
  console.log('CATEGORY 2: JUDGES');
  console.log('======================================================================');
  const expectedJudges = [
    { slot: 1, loginId: 'judge1', identifier: 'JUDGE-02' },
    { slot: 2, loginId: 'judge2', identifier: 'JUDGE-03' },
    { slot: 3, loginId: 'judge3', identifier: 'JUDGE-04' },
    { slot: 4, loginId: 'judge4', identifier: 'JUDGE-05' },
    { slot: 5, loginId: 'judge5', identifier: 'JUDGE-06' },
    { slot: 6, loginId: 'judge6', identifier: 'JUDGE-07' },
  ];

  for (const j of expectedJudges) {
    const prof = profiles.find(p => p.identifier === j.identifier || p.login_id === j.loginId);
    const authById = prof ? users.find(u => u.id === prof.id) : null;
    console.log({
      slot: j.slot,
      loginId: j.loginId,
      identifier: j.identifier,
      profileId: prof?.id,
      role: prof?.role,
      isDisabled: prof?.is_disabled,
      authId: authById?.id,
      uuidMatch: prof && authById && prof.id === authById.id,
    });
  }

  // Legacy JUDGE-01 check
  const judge01 = profiles.find(p => p.identifier === 'JUDGE-01');
  console.log('\nLegacy JUDGE-01 preservation:');
  console.log({
    identifier: judge01?.identifier,
    isDisabled: judge01?.is_disabled,
    preservedAsDisabled: judge01?.is_disabled === true,
  });

  // ── 3. Participants ──
  console.log('\n======================================================================');
  console.log('CATEGORY 3: PARTICIPANTS (86 OFFICIAL TEAMS)');
  console.log('======================================================================');
  const credsPath = path.resolve('.credentials/official_event_team_credentials.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

  const { rows: teams } = await pool.query('SELECT id, name FROM public.teams');

  let participantMatched = 0;
  let participantMismatched = 0;

  for (const t of creds) {
    const prof = profiles.find(p => p.identifier === t.canonicalIdentifier || p.login_id === t.loginId);
    const authById = prof ? users.find(u => u.id === prof.id) : null;
    const teamRecord = prof?.team_id ? teams.find(tm => tm.id === prof.team_id) : null;

    const isOk =
      prof &&
      authById &&
      prof.id === authById.id &&
      prof.role === 'participant' &&
      !prof.is_disabled &&
      teamRecord;

    if (isOk) {
      participantMatched++;
    } else {
      participantMismatched++;
      console.log(`MISMATCH: ${t.teamId} (${t.loginId})`);
    }
  }

  console.log(`\nParticipant Summary:`);
  console.log(`  Total Official Teams: ${creds.length}`);
  console.log(`  Matched & Consistent: ${participantMatched}`);
  console.log(`  Mismatched / Broken: ${participantMismatched}`);

  await pool.end();
}

reconcileAll().catch(err => {
  console.error(err);
  process.exit(1);
});
