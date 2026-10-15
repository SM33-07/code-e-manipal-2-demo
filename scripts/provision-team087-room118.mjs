import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const proposedPassword = process.env.PROPOSED_PASSWORD;

if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

if (!proposedPassword) {
  console.error('❌ Error: PROPOSED_PASSWORD environment variable is required.');
  process.exit(1);
}

// ── Environment Guardrail ───────────────────────────────────────────────────
const parsedDb = new URL(databaseUrl);
const dbName = parsedDb.pathname.replace(/^\//, '').split('?')[0];
if (dbName !== 'cem_staging') {
  console.error(`❌ FATAL GUARDRAIL VIOLATION: Target database must be "cem_staging", got "${dbName}"!`);
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ROOM_118_TEAM = {
  teamId: 'TEAM087',
  canonicalId: 'TEAM-087',
  loginId: 'TEAM087',
  teamName: 'Room 118',
  leaderName: 'Kanishk Satyajit Das',
  leaderEmail: 'kanishksatyajitdas@gmail.com',
  participants: [
    {
      fullName: 'Kanishk Satyajit Das',
      email: 'kanishksatyajitdas@gmail.com',
      phone: '+91 99786 10402',
      college: 'MUJ',
      studyYear: '3rd Year',
      isLeader: true,
    },
    {
      fullName: 'Piyush Agarwal',
      email: 'piyushagarwal5525@gmail.com',
      phone: '+91 89496 24318',
      college: 'Manipal University jaipur',
      studyYear: '3rd Year',
      isLeader: false,
    },
    {
      fullName: 'Veer Jain',
      email: 'veertiarra123@gmail.com',
      phone: '+91 74859 63139',
      college: 'Manipal University Jaipur ',
      studyYear: '4th Year',
      isLeader: false,
    },
    {
      fullName: 'Ashita Saxena',
      email: 'ashitas2024@gmail.com',
      phone: '+91 93217 65838',
      college: 'Manipa University Jaipur',
      studyYear: '3rd Year',
      isLeader: false,
    },
  ],
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — Provision Room 118 / TEAM087 (Staging)            ║');
  console.log('║   Target: cem_staging / ggmwribwynonpsvsmpyz                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const client = await pool.connect();

  try {
    // 1. Check for collisions
    console.log('1. Checking for collisions on TEAM087 and Room 118...');
    const { rows: existingTeams } = await client.query(
      "SELECT id, name, invite_code FROM public.teams WHERE invite_code = $1 OR name = $2",
      [ROOM_118_TEAM.teamId, ROOM_118_TEAM.teamName]
    );

    const { rows: existingProfiles } = await client.query(
      "SELECT id, name, email, identifier, login_id FROM public.profiles WHERE login_id = $1 OR identifier = $2",
      [ROOM_118_TEAM.loginId, ROOM_118_TEAM.canonicalId]
    );

    if (existingTeams.length > 0) {
      const match = existingTeams[0];
      if (match.name !== ROOM_118_TEAM.teamName || match.invite_code !== ROOM_118_TEAM.teamId) {
        throw new Error(`Collision detected: Team ${match.invite_code} "${match.name}" already occupies identifier.`);
      }
      console.log(`   Found existing team record (${match.id}). Will reconcile idempotently.`);
    } else {
      console.log(`   Confirmed: TEAM087 and "Room 118" are available for provisioning.`);
    }

    if (existingProfiles.length > 0) {
      const match = existingProfiles[0];
      if (match.login_id !== ROOM_118_TEAM.loginId) {
        throw new Error(`Collision detected: Profile ${match.identifier} (${match.email}) occupies identifier.`);
      }
      console.log(`   Found existing profile record (${match.id}). Will reconcile idempotently.`);
    }

    // 2. Supabase Auth User Provisioning
    console.log('\n2. Provisioning / Reconciling Supabase Auth User...');
    let authUserId = null;

    // Search for existing user in Supabase Auth
    let allUsers = [];
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      allUsers.push(...data.users);
      if (data.users.length < 100) break;
    }

    const existingAuthUser = allUsers.find(
      (u) => u.email?.toLowerCase() === ROOM_118_TEAM.leaderEmail.toLowerCase()
    );

    if (existingAuthUser) {
      console.log(`   Found existing Supabase Auth user (${existingAuthUser.id}). Updating password & metadata...`);
      authUserId = existingAuthUser.id;
      const { error: updateErr } = await supabase.auth.admin.updateUserById(authUserId, {
        password: proposedPassword,
        email_confirm: true,
        user_metadata: {
          name: ROOM_118_TEAM.leaderName,
          role: 'participant',
          identifier: ROOM_118_TEAM.canonicalId,
          login_id: ROOM_118_TEAM.loginId,
          team_name: ROOM_118_TEAM.teamName,
        },
      });
      if (updateErr) throw new Error(`Supabase Auth updateUserById failed: ${updateErr.message}`);
    } else {
      console.log(`   Creating new Supabase Auth user for ${ROOM_118_TEAM.leaderEmail}...`);
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: ROOM_118_TEAM.leaderEmail,
        password: proposedPassword,
        email_confirm: true,
        user_metadata: {
          name: ROOM_118_TEAM.leaderName,
          role: 'participant',
          identifier: ROOM_118_TEAM.canonicalId,
          login_id: ROOM_118_TEAM.loginId,
          team_name: ROOM_118_TEAM.teamName,
        },
      });
      if (createErr || !createData.user) {
        throw new Error(`Supabase Auth createUser failed: ${createErr?.message}`);
      }
      authUserId = createData.user.id;
    }
    console.log(`   Supabase Auth user ID: ${authUserId}`);

    // 3. PostgreSQL Database Provisioning (Atomic Transaction)
    console.log('\n3. Executing atomic database transaction in Azure PostgreSQL...');
    await client.query('BEGIN');

    // A. Shadow auth.users
    await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
      [
        authUserId,
        ROOM_118_TEAM.leaderEmail,
        JSON.stringify({
          name: ROOM_118_TEAM.leaderName,
          role: 'participant',
          identifier: ROOM_118_TEAM.canonicalId,
          login_id: ROOM_118_TEAM.loginId,
          team_name: ROOM_118_TEAM.teamName,
        }),
      ]
    );

    // B. public.teams
    const { rows: teamRows } = await client.query(
      `INSERT INTO public.teams (name, hackathon, invite_code, leader_name, created_by, track)
       VALUES ($1, 'Code-e-Manipal 2.0', $2, $3, $4, 'General')
       ON CONFLICT (name) DO UPDATE SET
         leader_name = EXCLUDED.leader_name,
         invite_code = EXCLUDED.invite_code,
         updated_at = NOW()
       RETURNING id`,
      [ROOM_118_TEAM.teamName, ROOM_118_TEAM.teamId, ROOM_118_TEAM.leaderName, authUserId]
    );
    const teamDbId = teamRows[0].id;
    console.log(`   Team record created/updated. DB UUID: ${teamDbId}`);

    // C. public.profiles
    await client.query(
      `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id, team_id)
       VALUES ($1, $2, $3, '', 'participant', $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = 'participant',
         identifier = EXCLUDED.identifier,
         login_id = EXCLUDED.login_id,
         team_id = EXCLUDED.team_id,
         updated_at = NOW()`,
      [authUserId, ROOM_118_TEAM.leaderName, ROOM_118_TEAM.leaderEmail, ROOM_118_TEAM.canonicalId, ROOM_118_TEAM.loginId, teamDbId]
    );
    console.log(`   Team profile created/updated. Login ID: ${ROOM_118_TEAM.loginId}, Canonical: ${ROOM_118_TEAM.canonicalId}`);

    // D. public.team_members (Leader + 3 Members)
    console.log('\n4. Persisting 4 participants into public.team_members...');
    for (const p of ROOM_118_TEAM.participants) {
      if (p.isLeader) {
        // Leader: user_id = authUserId, is_verified = TRUE
        await client.query(
          `INSERT INTO public.team_members (
             team_id, user_id, role, name, email, phone, college, study_year, is_verified, joined_at
           ) VALUES ($1, $2, 'leader', $3, $4, $5, $6, $7, TRUE, NOW())
           ON CONFLICT (team_id, user_id) WHERE user_id IS NOT NULL DO UPDATE SET
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             phone = EXCLUDED.phone,
             college = EXCLUDED.college,
             study_year = EXCLUDED.study_year,
             is_verified = TRUE`,
          [teamDbId, authUserId, p.fullName, p.email, p.phone, p.college, p.studyYear]
        );
        console.log(`   Leader added: ${p.fullName} (${p.email}) [VERIFIED LEADER]`);
      } else {
        // Non-leader members: user_id = NULL, is_verified = FALSE (no individual auth account)
        await client.query(
          `INSERT INTO public.team_members (
             team_id, user_id, role, name, email, phone, college, study_year, is_verified, joined_at
           ) VALUES ($1, NULL, 'member', $2, $3, $4, $5, $6, FALSE, NOW())
           ON CONFLICT (team_id, LOWER(TRIM(email))) WHERE email IS NOT NULL AND email <> ''
           DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             college = EXCLUDED.college,
             study_year = EXCLUDED.study_year`,
          [teamDbId, p.fullName, p.email, p.phone, p.college, p.studyYear]
        );
        console.log(`   Roster member added: ${p.fullName} (${p.email}) [ROSTER MEMBER]`);
      }
    }

    // E. Audit log (NO PASSWORDS)
    await client.query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1::uuid, 'PARTICIPANT_ACCOUNT_PROVISIONED', 'profiles', $2::text, $3)`,
      [
        authUserId,
        String(authUserId),
        JSON.stringify({
          team_id: ROOM_118_TEAM.teamId,
          canonical_identifier: ROOM_118_TEAM.canonicalId,
          login_id: ROOM_118_TEAM.loginId,
          team_name: ROOM_118_TEAM.teamName,
          leader_name: ROOM_118_TEAM.leaderName,
          participant_count: ROOM_118_TEAM.participants.length,
          role: 'participant',
        }),
      ]
    );

    await client.query('COMMIT');
    console.log('\n✅ Database transaction committed successfully.');

    // 5. Verify Persisted Records
    console.log('\n5. Verifying Persisted Team & Roster Records...');
    const { rows: verifyTeam } = await client.query(
      'SELECT id, name, invite_code, leader_name FROM public.teams WHERE invite_code = $1',
      [ROOM_118_TEAM.teamId]
    );
    console.log('   Persisted Team:', verifyTeam[0]);

    const { rows: verifyRoster } = await client.query(
      'SELECT id, role, name, email, phone, college, study_year, is_verified FROM public.team_members WHERE team_id = $1 ORDER BY role DESC, joined_at ASC',
      [teamDbId]
    );
    console.log(`   Persisted Roster Count: ${verifyRoster.length}`);
    verifyRoster.forEach((m, idx) => {
      console.log(`     ${idx + 1}. [${m.role.toUpperCase()}] ${m.name} | ${m.email} | Verified: ${m.is_verified}`);
    });

    if (verifyRoster.length !== 4) {
      throw new Error(`Expected exactly 4 roster members, found ${verifyRoster.length}`);
    }

    // 6. Test Authentication & Session Limits
    console.log('\n6. Testing Login & Authentication Flow...');

    // Test A: Direct Supabase Auth signInWithPassword using email
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: ROOM_118_TEAM.leaderEmail,
      password: proposedPassword,
    });
    if (signInErr || !signInData.user) {
      throw new Error(`Login test failed: ${signInErr?.message}`);
    }
    console.log(`   ✅ Direct Supabase Auth sign-in succeeded for ${ROOM_118_TEAM.leaderEmail}`);

    return {
      success: true,
      teamId: ROOM_118_TEAM.teamId,
      canonicalId: ROOM_118_TEAM.canonicalId,
      teamDbId,
      authUserId,
      rosterCount: verifyRoster.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Provisioning failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
