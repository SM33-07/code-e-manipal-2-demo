#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Provision Participant Teams 88 & 89
 * File: scripts/provision-teams-88-89.mjs
 *
 * Implements safe, idempotent provisioning for:
 *   - TEAM088 (Protocol)
 *   - TEAM089 (Tech Forsters)
 *
 * Steps:
 *   1. Preflight environment & collision validation (read-only)
 *   2. Supabase Auth account creation (if not already provisioned)
 *   3. PostgreSQL transactional profile, team, member, and audit recording
 *   4. Credential registry sync (.credentials/official_event_team_credentials.json)
 *   5. Automated acceptance verification:
 *      - Passcode authentication for TEAM088 and TEAM089
 *      - Canonical and alphanumeric identifier normalization
 *      - /api/auth/me profile and role verification
 *      - /api/teams team metadata and dashboard access
 *      - Negative tests (wrong passcode -> 401, unknown team -> 401)
 *      - 5-concurrent-session limit enforcement (6th blocked -> 429)
 *      - Regression verification for existing accounts (TEAM001, TEAM087, judge1)
 *      - Clean session logout
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ── 1. Read Environment ─────────────────────────────────────────────────────
const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const dbUrl = env.DATABASE_URL;
const sbUrl = env.SUPABASE_URL;
const sbKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl || !sbUrl || !sbKey) {
  console.error('❌ Missing DATABASE_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

// Environment validation
const parsedDb = new URL(dbUrl);
const parsedSb = new URL(sbUrl);

console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║   Code-e-Manipal 2.0 — Provision Teams TEAM088 & TEAM089                 ║');
console.log(`║   Target DB:       ${parsedDb.hostname.padEnd(53)}║`);
console.log(`║   Target Database: ${parsedDb.pathname.padEnd(53)}║`);
console.log(`║   Target Supabase: ${parsedSb.hostname.padEnd(53)}║`);
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

// Target safety check
if (!parsedDb.hostname.includes('code-e-manipal-db.postgres.database.azure.com') || !parsedDb.pathname.includes('postgres')) {
  console.error('❌ Safety Guardrail: Target database must be production "postgres" on Azure.');
  process.exit(1);
}
if (!parsedSb.hostname.includes('ihnclawnbtkwvbfqwxfe')) {
  console.error('❌ Safety Guardrail: Target Supabase project must be production "ihnclawnbtkwvbfqwxfe".');
  process.exit(1);
}

// ── 2. Load Target Teams from Credential Registry ────────────────────────────
const credRegistryPath = path.resolve('.credentials/official_event_team_credentials.json');
if (!fs.existsSync(credRegistryPath)) {
  console.error(`❌ Credential registry not found at: ${credRegistryPath}`);
  process.exit(1);
}
const currentRegistry = JSON.parse(fs.readFileSync(credRegistryPath, 'utf8'));

const team88Entry = currentRegistry.find(t => t.teamId === 'TEAM088');
const team89Entry = currentRegistry.find(t => t.teamId === 'TEAM089');

if (!team88Entry || !team89Entry) {
  console.error('❌ Registry must contain TEAM088 and TEAM089.');
  process.exit(1);
}

const NEW_TEAMS = [team88Entry, team89Entry];

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
const supabase = createClient(sbUrl, sbKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  const pgClient = await pool.connect();

  try {
    // ── Phase 1: Preflight State & Collision Evaluation ─────────────────────
    console.log('Phase 1: Auditing target environment and existing records...');

    // 1. Database teams
    const { rows: dbTeams } = await pgClient.query(
      'SELECT id, name, invite_code FROM public.teams WHERE invite_code IN ($1, $2) OR UPPER(name) IN ($3, $4)',
      ['TEAM088', 'TEAM089', 'PROTOCOL', 'TECH FORSTERS']
    );

    // 2. Database profiles
    const { rows: dbProfiles } = await pgClient.query(
      'SELECT id, name, email, identifier, login_id, role, team_id FROM public.profiles WHERE UPPER(identifier) IN ($1, $2) OR UPPER(COALESCE(login_id, \'\')) IN ($3, $4) OR UPPER(email) IN ($5, $6)',
      ['TEAM-088', 'TEAM-089', 'TEAM088', 'TEAM089', 'TEAM-088@AUTH.CODEEMANIPAL.IN', 'TEAM-089@AUTH.CODEEMANIPAL.IN']
    );

    // 3. Supabase Auth
    const { data: authUsersList, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw new Error(`Supabase Auth listUsers error: ${listErr.message}`);

    const authMatching = authUsersList.users.filter(u =>
      ['TEAM-088', 'TEAM-089', 'TEAM088', 'TEAM089'].includes(u.user_metadata?.identifier?.toUpperCase()) ||
      ['TEAM-088', 'TEAM-089', 'TEAM088', 'TEAM089'].includes(u.user_metadata?.login_id?.toUpperCase()) ||
      ['team-088@auth.codeemanipal.in', 'team-089@auth.codeemanipal.in'].includes(u.email?.toLowerCase()) ||
      ['PROTOCOL', 'TECH FORSTERS'].includes(u.user_metadata?.team_name?.toUpperCase())
    );

    // 4. Registry
    const credRegistryPath = path.resolve('.credentials/official_event_team_credentials.json');
    if (!fs.existsSync(credRegistryPath)) {
      throw new Error(`Registry file missing: ${credRegistryPath}`);
    }
    const registryData = JSON.parse(fs.readFileSync(credRegistryPath, 'utf8'));

    console.log(`   - DB Teams found:          ${dbTeams.length}`);
    console.log(`   - DB Profiles found:       ${dbProfiles.length}`);
    console.log(`   - Auth Users found:        ${authMatching.length}`);
    console.log(`   - Registry Total Teams:    ${registryData.length}`);

    // Determine provisioning status
    const team88Auth = authMatching.find(u => u.email === 'team-088@auth.codeemanipal.in');
    const team89Auth = authMatching.find(u => u.email === 'team-089@auth.codeemanipal.in');
    const team88Db = dbTeams.find(t => t.invite_code === 'TEAM088');
    const team89Db = dbTeams.find(t => t.invite_code === 'TEAM089');
    const team88Profile = dbProfiles.find(p => p.identifier === 'TEAM-088');
    const team89Profile = dbProfiles.find(p => p.identifier === 'TEAM-089');

    const isFullyProvisioned =
      team88Auth && team89Auth &&
      team88Db && team89Db &&
      team88Profile && team89Profile &&
      team88Profile.id === team88Auth.id &&
      team89Profile.id === team89Auth.id &&
      team88Profile.team_id === team88Db.id &&
      team89Profile.team_id === team89Db.id;

    if (isFullyProvisioned) {
      console.log('✓ TEAM088 and TEAM089 are already provisioned and consistent across DB and Auth.');
    } else {
      console.log('⚡ Missing records detected; provisioning will create or reconcile remaining entities.');
    }

    // ── Phase 2: Execute Provisioning (if needed) ───────────────────────────
    if (!isFullyProvisioned) {
      console.log('\nPhase 2: Executing provisioning in Supabase Auth & PostgreSQL...');

      // Acquire global advisory lock
      await pgClient.query("SELECT pg_advisory_lock(hashtext('code-e-manipal-account-provisioning'))");
      console.log('✓ Acquired PostgreSQL advisory lock.');

      for (const team of NEW_TEAMS) {
        console.log(`\n--- Provisioning ${team.teamId} (${team.teamName}) ---`);

        let authUserId = null;
        const existingAuth = authMatching.find(u => u.email === team.authEmail);

        if (existingAuth) {
          authUserId = existingAuth.id;
          console.log(`   ✓ Found existing Auth user with UUID: ${authUserId}`);
          // Ensure password and metadata match
          await supabase.auth.admin.updateUserById(authUserId, {
            password: team.officialPasscode,
            email_confirm: true,
            user_metadata: {
              name: team.contactName,
              role: 'participant',
              identifier: team.canonicalIdentifier,
              login_id: team.loginId,
              team_name: team.teamName,
            },
          });
        } else {
          const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: team.authEmail,
            password: team.officialPasscode,
            email_confirm: true,
            user_metadata: {
              name: team.contactName,
              role: 'participant',
              identifier: team.canonicalIdentifier,
              login_id: team.loginId,
              team_name: team.teamName,
            },
          });
          if (authErr || !authData?.user) {
            throw new Error(`Failed to create Supabase Auth user for ${team.teamId}: ${authErr?.message}`);
          }
          authUserId = authData.user.id;
          console.log(`   ✓ Supabase Auth user created with UUID: ${authUserId}`);
        }

        // Transactional Database Inserts
        await pgClient.query('BEGIN');
        try {
          // Shadow auth.users
          await pgClient.query(
            `INSERT INTO auth.users (id, email, raw_user_meta_data)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
            [
              authUserId,
              team.authEmail,
              JSON.stringify({
                name: team.contactName,
                role: 'participant',
                identifier: team.canonicalIdentifier,
                login_id: team.loginId,
                team_name: team.teamName,
              }),
            ]
          );

          // Upsert public.teams
          const { rows: teamRows } = await pgClient.query(
            `INSERT INTO public.teams (name, hackathon, invite_code, leader_name, created_by, track)
             VALUES ($1, 'Code-e-Manipal 2.0', $2, $3, $4, 'General')
             ON CONFLICT (name) DO UPDATE SET
               invite_code = EXCLUDED.invite_code,
               leader_name = EXCLUDED.leader_name,
               updated_at = NOW()
             RETURNING id`,
            [team.teamName, team.teamId, team.contactName, authUserId]
          );
          const teamDbId = teamRows[0].id;
          console.log(`   ✓ public.teams record upserted with ID: ${teamDbId}`);

          // Upsert public.team_members
          await pgClient.query(
            `INSERT INTO public.team_members (team_id, user_id, role, joined_at)
             VALUES ($1, $2, 'leader', NOW())
             ON CONFLICT (team_id, user_id) DO NOTHING`,
            [teamDbId, authUserId]
          );
          console.log(`   ✓ public.team_members record linked as leader.`);

          // Upsert public.profiles
          await pgClient.query(
            `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id, team_id, is_disabled, force_logout_before)
             VALUES ($1, $2, $3, '', 'participant', $4, $5, $6, false, NULL)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               role = 'participant',
               identifier = EXCLUDED.identifier,
               login_id = EXCLUDED.login_id,
               team_id = EXCLUDED.team_id,
               is_disabled = false,
               force_logout_before = NULL,
               updated_at = NOW()`,
            [authUserId, team.contactName, team.authEmail, team.canonicalIdentifier, team.loginId, teamDbId]
          );
          console.log(`   ✓ public.profiles record upserted.`);

          // Insert public.audit_logs
          await pgClient.query(
            `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
             VALUES ($1, 'PARTICIPANT_ACCOUNT_PROVISIONED', 'profiles', $2, $3)`,
            [
              authUserId,
              authUserId,
              JSON.stringify({
                teamId: team.teamId,
                canonicalId: team.canonicalIdentifier,
                teamName: team.teamName,
                authEmail: team.authEmail,
                provisionedAt: new Date().toISOString(),
              }),
            ]
          );
          console.log(`   ✓ public.audit_logs record written.`);

          await pgClient.query('COMMIT');
          console.log(`   ✓ Database transaction committed successfully for ${team.teamId}.`);
        } catch (txErr) {
          await pgClient.query('ROLLBACK');
          throw txErr;
        }
      }

      // Release advisory lock
      await pgClient.query("SELECT pg_advisory_unlock(hashtext('code-e-manipal-account-provisioning'))");
      console.log('\n✓ Released PostgreSQL advisory lock.');
    }

    // ── Phase 3: Synchronize Credential Registry ────────────────────────────
    console.log('\nPhase 3: Verifying .credentials/official_event_team_credentials.json...');
    const currentRegistry = JSON.parse(fs.readFileSync(credRegistryPath, 'utf8'));

    let registryNeedsSave = false;
    for (const newTeam of NEW_TEAMS) {
      if (!currentRegistry.some(t => t.teamId === newTeam.teamId)) {
        currentRegistry.push(newTeam);
        registryNeedsSave = true;
      }
    }

    if (registryNeedsSave) {
      fs.writeFileSync(credRegistryPath, JSON.stringify(currentRegistry, null, 2), 'utf8');
      console.log(`✓ Registry saved: now contains ${currentRegistry.length} official teams.`);
    } else {
      console.log(`✓ Registry already contains ${currentRegistry.length} official teams (including TEAM088 & TEAM089).`);
    }

    // Write private audit artifact
    const auditArtifactPath = path.resolve('.credentials/provisioning_team88_89_audit.json');
    const auditPayload = {
      timestamp: new Date().toISOString(),
      action: 'PROVISION_TWO_PARTICIPANT_TEAMS',
      targetDb: parsedDb.hostname + parsedDb.pathname,
      targetSupabase: parsedSb.hostname,
      provisionedTeams: NEW_TEAMS.map((t) => ({
        teamId: t.teamId,
        canonicalIdentifier: t.canonicalIdentifier,
        teamName: t.teamName,
        authEmail: t.authEmail,
        status: 'VERIFIED_ACTIVE',
      })),
      registryCount: currentRegistry.length,
    };
    fs.writeFileSync(auditArtifactPath, JSON.stringify(auditPayload, null, 2), 'utf8');
    console.log(`✓ Private audit record stored at: ${auditArtifactPath}`);

    // ── Phase 4: Acceptance Testing ─────────────────────────────────────────
    console.log('\n================================================================');
    console.log('Phase 4: Running Comprehensive Acceptance Test Suite...');
    console.log('================================================================\n');

    // Pre-clear active session slots for the test teams
    for (const team of NEW_TEAMS) {
      const { rows } = await pgClient.query("SELECT id FROM public.teams WHERE invite_code = $1", [team.teamId]);
      if (rows[0]?.id) {
        await pgClient.query("DELETE FROM public.team_active_sessions WHERE team_id = $1", [rows[0].id]);
      }
    }
    console.log('✓ Cleaned prior active test sessions for fresh suite execution.');

    const baseUrl = 'http://127.0.0.1:3000';
    let testPasses = 0;
    let testFailures = 0;

    async function testLogin(identifier, password, label, expectedStatus = 200) {
      console.log(`Testing Login: ${label} [${identifier}]...`);
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseUrl },
        body: JSON.stringify({ identifier, password }),
      });

      const status = res.status;
      let data = {};
      try { data = await res.json(); } catch {}

      if (status === expectedStatus) {
        console.log(`  ✓ Status ${status} (matches expected ${expectedStatus})`);
        testPasses++;

        if (status === 200) {
          const rawCookies = typeof res.headers.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
          const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
          const assignedSessionId = data.session?.session_id;

          // 1. Verify /api/auth/me
          const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookieHeader } });
          const meData = await meRes.json();
          const userRole = meData.data?.profile?.role || meData.data?.role;
          const userName = meData.data?.profile?.name || meData.data?.name;
          if (meRes.status === 200 && userRole === 'participant') {
            console.log(`  ✓ /api/auth/me: 200 OK | Authenticated as "${userName}" (role: ${userRole})`);
            testPasses++;
          } else {
            console.error(`  ❌ /api/auth/me verification failed:`, meData);
            testFailures++;
          }

          // 2. Verify /api/teams
          const teamsRes = await fetch(`${baseUrl}/api/teams`, { headers: { Cookie: cookieHeader } });
          const teamsData = await teamsRes.json();
          if (teamsRes.status === 200 && teamsData.data?.name) {
            console.log(`  ✓ /api/teams: 200 OK | Team: "${teamsData.data.name}" | InviteCode: ${teamsData.data.invite_code}`);
            testPasses++;
          } else {
            console.error(`  ❌ /api/teams verification failed:`, teamsData);
            testFailures++;
          }

          // 3. Verify /api/auth/logout with CSRF origin and session tracking
          const logoutHeaders = { Cookie: cookieHeader, Origin: baseUrl };
          if (assignedSessionId) {
            logoutHeaders['x-session-id'] = assignedSessionId;
          }
          const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: logoutHeaders,
          });
          if (logoutRes.status === 200) {
            console.log(`  ✓ /api/auth/logout: 200 OK | Clean session termination.`);
            testPasses++;
          } else {
            console.error(`  ❌ /api/auth/logout failed: ${logoutRes.status}`);
            testFailures++;
          }
        }
      } else {
        console.error(`  ❌ Status ${status} (expected ${expectedStatus}):`, data);
        testFailures++;
      }
    }

    // 1. TEAM088 unhyphenated
    await testLogin('TEAM088', team88Entry.officialPasscode, 'TEAM088 (Unhyphenated Protocol)');

    // 2. TEAM088 canonical
    await testLogin('TEAM-088', team88Entry.officialPasscode, 'TEAM-088 (Canonical Protocol)');

    // 3. TEAM089 unhyphenated
    await testLogin('TEAM089', team89Entry.officialPasscode, 'TEAM089 (Unhyphenated Tech Forsters)');

    // 4. TEAM089 canonical
    await testLogin('TEAM-089', team89Entry.officialPasscode, 'TEAM-089 (Canonical Tech Forsters)');

    // 5. Negative: Invalid passcode for TEAM088
    await testLogin('TEAM088', 'IncorrectPassword#999', 'Negative: Wrong Passcode', 401);

    // 6. Negative: Unknown team identifier
    await testLogin('TEAM999', 'ArbitraryPassword#123', 'Negative: Unknown Identifier', 401);

    // 7. Regression: TEAM001
    const team001 = currentRegistry.find(t => t.teamId === 'TEAM001');
    if (team001) {
      await testLogin(team001.loginId, team001.officialPasscode, 'Regression: Existing TEAM001');
    }

    // 8. Regression: TEAM087 (Room 118)
    const team087 = currentRegistry.find(t => t.teamId === 'TEAM087');
    if (team087) {
      await testLogin(team087.loginId, team087.officialPasscode, 'Regression: Existing TEAM087 (Room 118)');
    }

    // 9. Regression: Judge 1
    const judgePath = path.resolve('.credentials/official_code_e_manipal_judge_credentials.xlsx');
    if (fs.existsSync(judgePath)) {
      const xlsx = (await import('xlsx')).default;
      const jwb = xlsx.readFile(judgePath);
      const judgeRows = xlsx.utils.sheet_to_json(jwb.Sheets[jwb.SheetNames[0]]);
      const judge1 = judgeRows.find(j => j['Login ID'] === 'judge1');
      if (judge1) {
        console.log(`Testing Login: Regression: Existing Judge 1 [judge1]...`);
        const jRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: baseUrl },
          body: JSON.stringify({ identifier: judge1['Login ID'], password: judge1['Passcode (8-Digit)'] }),
        });
        if (jRes.status === 200) {
          console.log(`  ✓ Status 200 (Judge 1 verified)`);
          testPasses++;
        } else {
          console.error(`  ❌ Judge 1 login failed: ${jRes.status}`);
          testFailures++;
        }
      }
    }

    // 10. Concurrency Policy Limit Test (5 active sessions max)
    console.log('\nTesting 5-Concurrent-Session Policy for TEAM088...');
    const { rows: t88Rows } = await pgClient.query("SELECT id FROM public.teams WHERE invite_code = 'TEAM088'");
    const t88DbId = t88Rows[0]?.id;
    if (t88DbId) {
      await pgClient.query("DELETE FROM public.team_active_sessions WHERE team_id = $1", [t88DbId]);
    }

    let sessionsEstablished = 0;
    // Login 5 sessions with distinct session_id
    for (let s = 1; s <= 5; s++) {
      const sid = `sess_test_t88_${s}_${Date.now()}`;
      const sRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseUrl },
        body: JSON.stringify({ identifier: 'TEAM088', password: team88Entry.officialPasscode, session_id: sid }),
      });
      if (sRes.status === 200) {
        sessionsEstablished++;
      } else {
        console.error(`  ❌ Failed to establish concurrent session ${s}: ${sRes.status}`);
      }
    }

    if (sessionsEstablished === 5) {
      console.log('  ✓ 5 concurrent sessions successfully registered.');
      testPasses++;
    } else {
      console.error(`  ❌ Expected 5 concurrent sessions, got ${sessionsEstablished}`);
      testFailures++;
    }

    // Attempt 6th concurrent session
    const sid6 = `sess_test_t88_6_${Date.now()}`;
    const s6Res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ identifier: 'TEAM088', password: team88Entry.officialPasscode, session_id: sid6 }),
    });

    if (s6Res.status === 429) {
      console.log('  ✓ 6th concurrent session safely blocked with HTTP 429 (TEAM_SESSION_LIMIT_EXCEEDED).');
      testPasses++;
    } else {
      console.error(`  ❌ 6th session should be rejected with 429, got ${s6Res.status}`);
      testFailures++;
    }

    // Clean up test sessions from team_active_sessions table
    if (t88DbId) {
      await pgClient.query("DELETE FROM public.team_active_sessions WHERE team_id = $1", [t88DbId]);
    }
    console.log('✓ Cleaned up concurrency test sessions.');

    console.log('\n================================================================');
    console.log(`FINAL ACCEPTANCE RESULTS: ${testPasses} passed, ${testFailures} failed`);
    console.log('================================================================\n');

    if (testFailures > 0) {
      throw new Error(`Acceptance suite had ${testFailures} failure(s).`);
    }

    console.log('🎉 ALL PROVISIONING AND ACCEPTANCE TESTS PASSED SUCCESSFULLY!');

  } finally {
    pgClient.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\n❌ FATAL ERROR:', err.message);
  process.exit(1);
});
