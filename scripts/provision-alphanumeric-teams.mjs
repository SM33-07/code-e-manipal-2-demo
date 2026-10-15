#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Idempotent Participant Provisioning Utility
 * File: scripts/provision-alphanumeric-teams.mjs
 *
 * Provisions participant accounts from the authoritative alphanumeric CSV into:
 *  1. Supabase Auth (GoTrue identity provider - storing hashed credentials)
 *  2. Azure PostgreSQL (shadow auth.users, public.teams, public.team_members, public.profiles)
 *
 * Safety & Architecture Rules:
 *  - Supabase Auth is authoritative for authentication identities and password hashes.
 *  - Azure PostgreSQL stores application profiles, team records, and audit logs.
 *  - Plaintext passcodes are NEVER stored in PostgreSQL, logs, or telemetry.
 *  - Strict role-specific policy: exactly 8 alphanumeric characters containing letters and digits.
 *  - Idempotent and recoverable: can be run repeatedly without duplicate accounts.
 *  - Default mode: --dry-run (zero writes). Mutation requires --execute --confirm yes.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { parseCSV, validateRoster } from './validate-csv.mjs';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL is missing. Please provide via environment or --env-file');
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
  process.exit(1);
}

// Format canonical identifier: 'TEAM001' -> 'TEAM-001'
export function toCanonicalIdentifier(teamId) {
  const numPart = teamId.replace(/^TEAM-?/i, '');
  return `TEAM-${numPart.padStart(3, '0')}`;
}

// ── State Fetching ───────────────────────────────────────────────────────────
async function fetchSystemState(pgClient, supabase) {
  const { rows: profiles } = await pgClient.query(`
    SELECT id, name, email, role, identifier, login_id, team_id, is_disabled
    FROM public.profiles;
  `);

  const { rows: teams } = await pgClient.query(`
    SELECT id, name, invite_code, leader_name, created_by
    FROM public.teams;
  `);

  const { rows: teamMembers } = await pgClient.query(`
    SELECT team_id, user_id, role
    FROM public.team_members;
  `);

  const authUsers = [];
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Supabase Auth listUsers failed: ${error.message}`);
    authUsers.push(...data.users);
    if (data.users.length < 100) break;
  }

  return { profiles, teams, teamMembers, authUsers };
}

// ── Record Evaluation ───────────────────────────────────────────────────────
function evaluateTeam(team, state) {
  const canonicalId = toCanonicalIdentifier(team.teamId);
  const unhyphenatedLoginId = team.loginId.toUpperCase();
  const leaderEmail = team.email.toLowerCase();

  const existingProfileById = state.profiles.find(
    (p) => (p.identifier || '').toUpperCase() === canonicalId || (p.login_id || '').toUpperCase() === unhyphenatedLoginId
  );
  const existingProfileByEmail = state.profiles.find(
    (p) => (p.email || '').toLowerCase() === leaderEmail
  );
  const existingTeamByName = state.teams.find(
    (t) => t.name === team.teamName
  );
  const existingTeamByCode = state.teams.find(
    (t) => (t.invite_code || '').toUpperCase() === team.teamId.toUpperCase()
  );
  const existingAuthUser = state.authUsers.find(
    (u) => (u.email || '').toLowerCase() === leaderEmail
  );

  // Case 1: Fully and consistently provisioned
  if (
    existingAuthUser &&
    existingProfileByEmail &&
    existingProfileByEmail.id === existingAuthUser.id &&
    existingProfileById &&
    existingProfileById.id === existingAuthUser.id &&
    existingTeamByName &&
    existingProfileByEmail.team_id === existingTeamByName.id
  ) {
    return {
      status: 'ALREADY_PROVISIONED',
      teamId: team.teamId,
      canonicalId,
      loginId: team.loginId,
      teamName: team.teamName,
      leaderEmail,
      authUserId: existingAuthUser.id,
      teamDbId: existingTeamByName.id,
      reason: 'Fully provisioned and verified consistent across Auth, profiles, and teams.',
    };
  }

  // Case 2: Identifier or Login ID conflict with a DIFFERENT email
  if (existingProfileById && (existingProfileById.email || '').toLowerCase() !== leaderEmail) {
    return {
      status: 'CONFLICT',
      teamId: team.teamId,
      canonicalId,
      loginId: team.loginId,
      teamName: team.teamName,
      leaderEmail,
      reason: `Identifier "${canonicalId}" / Login ID "${unhyphenatedLoginId}" already belongs to "${existingProfileById.email}" (UUID ${existingProfileById.id})`,
    };
  }

  // Case 3: Email exists in profiles under a different identifier
  if (existingProfileByEmail && (existingProfileByEmail.identifier || '').toUpperCase() !== canonicalId) {
    return {
      status: 'CONFLICT',
      teamId: team.teamId,
      canonicalId,
      loginId: team.loginId,
      teamName: team.teamName,
      leaderEmail,
      reason: `Email "${leaderEmail}" exists in public.profiles with different identifier "${existingProfileByEmail.identifier}"`,
    };
  }

  // Case 4: Auth user exists in Supabase Auth — reconcile profile and team in PostgreSQL
  if (existingAuthUser) {
    return {
      status: 'RECONCILE_PROFILE',
      teamId: team.teamId,
      canonicalId,
      loginId: team.loginId,
      teamName: team.teamName,
      leaderName: team.leaderName,
      leaderEmail,
      passcode: team.passcode,
      authUserId: existingAuthUser.id,
      reason: 'Supabase Auth user exists; PostgreSQL profile and team association require reconciliation.',
    };
  }

  // Case 5: Clean, ready to provision from scratch
  return {
    status: 'READY_TO_CREATE',
    teamId: team.teamId,
    canonicalId,
    loginId: team.loginId,
    teamName: team.teamName,
    leaderName: team.leaderName,
    leaderEmail,
    passcode: team.passcode,
    reason: 'Clean for provisioning in Supabase Auth and Azure PostgreSQL.',
  };
}

// ── Main Execution Routine ──────────────────────────────────────────────────
export async function provisionAlphanumericTeams(options = {}) {
  const {
    csvPath = 'code_e_manipal_team_leader_logins_alphanumeric.csv',
    isExecute = false,
    confirm = false,
    verifyLogins = true,
  } = options;

  console.log('================================================================');
  console.log('  Code-e-Manipal 2.0 — Alphanumeric Participant Provisioning');
  console.log('================================================================');
  console.log(`Roster File: ${csvPath}`);
  console.log(`Execution Mode: ${isExecute ? 'EXECUTE (Applying changes)' : 'DRY-RUN (Zero writes)'}`);
  console.log('----------------------------------------------------------------\n');

  // 1. Read and validate CSV
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  const rawCsv = fs.readFileSync(csvPath, 'utf8');
  const parsedRows = parseCSV(rawCsv);
  const validation = validateRoster(parsedRows);

  console.log(`CSV Pre-flight Check:`);
  console.log(`  - Total Data Rows: ${validation.totalTeams}`);
  console.log(`  - Validation Passed: ${validation.valid}`);
  console.log(`  - Format Errors: ${validation.errors.length}`);
  console.log(`  - Duplicate Team Names: ${validation.duplicateNames.length}`);

  if (!validation.valid) {
    console.error('\n❌ CSV Validation Failed with errors:');
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    throw new Error('CSV validation failed. Aborting provisioning.');
  }

  // 2. Connect to Database and Supabase
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const pgClient = await pool.connect();
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 3. Collect existing state
    const state = await fetchSystemState(pgClient, supabase);
    console.log(`\nCurrent Environment Snapshot:`);
    console.log(`  - Azure PG Profiles: ${state.profiles.length}`);
    console.log(`  - Azure PG Teams: ${state.teams.length}`);
    console.log(`  - Supabase Auth Identities: ${state.authUsers.length}`);

    // 4. Evaluate each roster item
    const evaluations = validation.teams.map((t) => evaluateTeam(t, state));

    const readyCount = evaluations.filter((e) => e.status === 'READY_TO_CREATE').length;
    const reconcileCount = evaluations.filter((e) => e.status === 'RECONCILE_PROFILE').length;
    const alreadyCount = evaluations.filter((e) => e.status === 'ALREADY_PROVISIONED').length;
    const conflictCount = evaluations.filter((e) => e.status === 'CONFLICT').length;

    console.log(`\nEvaluation Breakdown:`);
    console.log(`  - Ready to Create: ${readyCount}`);
    console.log(`  - Reconcile Profile: ${reconcileCount}`);
    console.log(`  - Already Provisioned: ${alreadyCount}`);
    console.log(`  - Conflicts Detected: ${conflictCount}`);

    if (conflictCount > 0) {
      console.warn(`\n⚠️  The following ${conflictCount} account conflicts were detected:`);
      evaluations
        .filter((e) => e.status === 'CONFLICT')
        .forEach((c) => console.warn(`   - [${c.teamId}] ${c.leaderEmail} (${c.canonicalId}): ${c.reason}`));
    }

    // 5. Dry-Run early exit
    if (!isExecute) {
      console.log('\n================================================================');
      console.log('✅ DRY-RUN COMPLETED.');
      console.log('   Zero database or Auth changes were made.');
      console.log('   To apply mutations, rerun with:');
      console.log('   node scripts/provision-alphanumeric-teams.mjs --execute --confirm yes');
      console.log('================================================================');
      return {
        dryRun: true,
        totalTeams: validation.totalTeams,
        readyCount,
        reconcileCount,
        alreadyCount,
        conflictCount,
        evaluations,
      };
    }

    // Confirmation gate for execution
    if (!confirm) {
      throw new Error('Mutation aborted: --confirm yes flag is required to execute.');
    }

    if (conflictCount > 0) {
      throw new Error(`Aborting execution: ${conflictCount} unresolved conflicts exist. Resolve them before provisioning.`);
    }

    console.log('\n🚀 Executing Provisioning Workflow in Supabase Auth & Azure PostgreSQL...');

    let createdCount = 0;
    let reconciledCount = 0;
    let verifiedLoginCount = 0;
    const provisioningFailures = [];

    // Acquire global advisory lock during provisioning
    await pgClient.query("SELECT pg_advisory_lock(hashtext('code-e-manipal-account-provisioning'))");

    try {
      for (const item of evaluations) {
        if (item.status === 'ALREADY_PROVISIONED') {
          continue;
        }

        let authUserId = item.authUserId;

        // Step A: Create GoTrue user in Supabase Auth if needed
        if (item.status === 'READY_TO_CREATE') {
          const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: item.leaderEmail,
            password: item.passcode,
            email_confirm: true,
            user_metadata: {
              name: item.leaderName,
              role: 'participant',
              identifier: item.canonicalId,
              login_id: item.loginId,
              team_name: item.teamName,
            },
          });

          if (authErr || !authData.user) {
            console.error(`   ❌ Failed to create Supabase Auth user for ${item.teamId} (${item.leaderEmail}):`, authErr?.message);
            provisioningFailures.push({ teamId: item.teamId, email: item.leaderEmail, stage: 'AUTH_CREATE', error: authErr?.message });
            continue;
          }

          authUserId = authData.user.id;
          createdCount++;
        }

        // Step B: Transactional PostgreSQL inserts
        await pgClient.query('BEGIN');
        try {
          // 1. Shadow auth.users
          await pgClient.query(
            `INSERT INTO auth.users (id, email, raw_user_meta_data)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
            [
              authUserId,
              item.leaderEmail,
              JSON.stringify({
                name: item.leaderName,
                role: 'participant',
                identifier: item.canonicalId,
                login_id: item.loginId,
                team_name: item.teamName,
              }),
            ]
          );

          // 2. public.teams (unique by name)
          const { rows: teamRows } = await pgClient.query(
            `INSERT INTO public.teams (name, hackathon, invite_code, leader_name, created_by, track)
             VALUES ($1, 'Code-e-Manipal 2.0', $2, $3, $4, 'General')
             ON CONFLICT (name) DO UPDATE SET
               leader_name = EXCLUDED.leader_name,
               invite_code = EXCLUDED.invite_code,
               updated_at = NOW()
             RETURNING id`,
            [item.teamName, item.teamId, item.leaderName, authUserId]
          );
          const teamDbId = teamRows[0].id;

          // 3. public.team_members
          await pgClient.query(
            `INSERT INTO public.team_members (team_id, user_id, role)
             VALUES ($1, $2, 'leader')
             ON CONFLICT (team_id, user_id) DO NOTHING`,
            [teamDbId, authUserId]
          );

          // 4. public.profiles (upsert)
          await pgClient.query(
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
            [authUserId, item.leaderName, item.leaderEmail, item.canonicalId, item.loginId, teamDbId]
          );

          // 5. Immutable audit log (NO PASSWORDS)
          await pgClient.query(
            `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
             VALUES ($1::uuid, 'PARTICIPANT_ACCOUNT_PROVISIONED', 'profiles', $2::text, $3)`,
            [
              authUserId,
              String(authUserId),
              JSON.stringify({
                team_id: item.teamId,
                canonical_identifier: item.canonicalId,
                login_id: item.loginId,
                team_name: item.teamName,
                leader_name: item.leaderName,
                role: 'participant',
              }),
            ]
          );

          await pgClient.query('COMMIT');

          if (item.status === 'RECONCILE_PROFILE') {
            reconciledCount++;
          }

          // Step C: Verify credential authentication if enabled
          if (verifyLogins && item.passcode) {
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
              email: item.leaderEmail,
              password: item.passcode,
            });

            if (signInErr || !signInData.user) {
              console.warn(`   ⚠️ Login verification warning for ${item.teamId}: ${signInErr?.message}`);
            } else {
              verifiedLoginCount++;
            }
          }

          process.stdout.write(`   ✅ [${item.teamId}] ${item.canonicalId} (${item.leaderEmail}) provisioned\n`);
        } catch (dbErr) {
          await pgClient.query('ROLLBACK');
          console.error(`   ❌ Database transaction error for ${item.teamId}:`, dbErr.message);
          provisioningFailures.push({ teamId: item.teamId, email: item.leaderEmail, stage: 'DB_TRANSACTION', error: dbErr.message });
        }
      }
    } finally {
      await pgClient.query("SELECT pg_advisory_unlock(hashtext('code-e-manipal-account-provisioning'))");
    }

    console.log('\n================================================================');
    console.log('🎉 PROVISIONING SUMMARY');
    console.log('================================================================');
    console.log(`Total Roster Rows: ${validation.totalTeams}`);
    console.log(`New Auth Users Created: ${createdCount}`);
    console.log(`Profiles Reconciled: ${reconciledCount}`);
    console.log(`Already Provisioned: ${alreadyCount}`);
    console.log(`Logins Verified: ${verifiedLoginCount}`);
    console.log(`Failures: ${provisioningFailures.length}`);

    if (provisioningFailures.length > 0) {
      console.error('\nFailures breakdown:');
      provisioningFailures.forEach((f) => console.error(`  - [${f.teamId}] ${f.email} at ${f.stage}: ${f.error}`));
    }
    console.log('================================================================\n');

    return {
      dryRun: false,
      totalTeams: validation.totalTeams,
      createdCount,
      reconciledCount,
      alreadyCount,
      verifiedLoginCount,
      failures: provisioningFailures,
    };
  } finally {
    pgClient.release();
    await pool.end();
  }
}

// CLI Entrypoint
if (process.argv[1] && process.argv[1].endsWith('provision-alphanumeric-teams.mjs')) {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const confirmArg = args[args.indexOf('--confirm') + 1];
  const confirm = confirmArg === 'yes';

  let csvPath = 'code_e_manipal_team_leader_logins_alphanumeric.csv';
  const csvIndex = args.indexOf('--csv');
  if (csvIndex !== -1 && args[csvIndex + 1]) {
    csvPath = args[csvIndex + 1];
  }

  provisionAlphanumericTeams({ csvPath, isExecute, confirm })
    .catch((err) => {
      console.error('Fatal Provisioning Error:', err.message);
      process.exit(1);
    });
}
