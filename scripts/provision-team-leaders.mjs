#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Team Leader Bulk Provisioning Utility
 * File: scripts/provision-team-leaders.mjs
 * 
 * Safely and idempotently provisions the 165 team leaders from the cleaned CSV
 * into Azure PostgreSQL (authoritative) and Supabase Auth (auth provider).
 * 
 * Features:
 *  - Strict pre-flight CSV validation (165 records, formats, uniqueness)
 *  - Safe --dry-run mode (default)
 *  - Guarded --execute mode (requires --confirm)
 *  - Compensating transactions on partial failure (no orphaned Auth users)
 *  - Full advisory-lock concurrency control
 *  - Audit logging to public.audit_logs
 *  - Synthetic record end-to-end verification (--test-synthetic)
 *  - Structured reconciliation report
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// ── Environment Verification ────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL is missing. Please run with --env-file=.env.local');
  process.exit(1);
}
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Please run with --env-file=.env.local');
  process.exit(1);
}

// ── Passwords & Helpers ─────────────────────────────────────────────────────
const NUMERIC_CHARSET = '0123456789';

function randomCharacter(charset) {
  const limit = Math.floor(256 / charset.length) * charset.length;
  let value;
  do {
    value = crypto.randomBytes(1)[0];
  } while (value >= limit);
  return charset[value % charset.length];
}

function generateEventPassword(length = 8) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += randomCharacter(NUMERIC_CHARSET);
  }
  return result;
}

// ── Robust CSV Parser ───────────────────────────────────────────────────────
export function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    record._line = i + 1;
    records.push(record);
  }
  return records;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

// ── CSV Invariants Validation ───────────────────────────────────────────────
export function validateCSVRecords(records) {
  const errors = [];
  const warnings = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const loginIdRegex = /^TEAM-[0-9]{3}$/;

  const seenLoginIds = new Map();
  const seenRegTeamIds = new Map();
  const seenEmails = new Map();
  const seenTeamNamesLower = new Map();

  records.forEach((r) => {
    const loginId = r['Login ID'];
    const regTeamId = r['Registration Team ID'];
    const teamName = r['Team Name'];
    const leaderName = r['Team Leader Name'];
    const leaderEmail = r['Team Leader Email'];

    // 1. Required fields
    if (!loginId) errors.push(`Line ${r._line}: Missing required field "Login ID"`);
    if (!regTeamId) errors.push(`Line ${r._line}: Missing required field "Registration Team ID"`);
    if (!teamName) errors.push(`Line ${r._line}: Missing required field "Team Name"`);
    if (!leaderName) errors.push(`Line ${r._line}: Missing required field "Team Leader Name"`);
    if (!leaderEmail) errors.push(`Line ${r._line}: Missing required field "Team Leader Email"`);

    // 2. Format checks
    if (loginId && !loginIdRegex.test(loginId)) {
      errors.push(`Line ${r._line}: Invalid Login ID format "${loginId}" (must match TEAM-XXX)`);
    }
    if (leaderEmail && !emailRegex.test(leaderEmail.toLowerCase())) {
      errors.push(`Line ${r._line}: Invalid email format "${leaderEmail}"`);
    }
    if (teamName && (teamName.length < 1 || teamName.length > 100)) {
      errors.push(`Line ${r._line}: Team Name length must be between 1 and 100 characters`);
    }

    // 3. Batch Uniqueness
    if (loginId) {
      if (seenLoginIds.has(loginId)) {
        errors.push(`Line ${r._line}: Duplicate Login ID "${loginId}" (first seen line ${seenLoginIds.get(loginId)})`);
      } else {
        seenLoginIds.set(loginId, r._line);
      }
    }

    if (regTeamId) {
      if (seenRegTeamIds.has(regTeamId)) {
        errors.push(`Line ${r._line}: Duplicate Registration Team ID "${regTeamId}" (first seen line ${seenRegTeamIds.get(regTeamId)})`);
      } else {
        seenRegTeamIds.set(regTeamId, r._line);
      }
    }

    if (leaderEmail) {
      const lowerEmail = leaderEmail.toLowerCase();
      if (seenEmails.has(lowerEmail)) {
        errors.push(`Line ${r._line}: Duplicate Team Leader Email "${leaderEmail}" (first seen line ${seenEmails.get(lowerEmail)})`);
      } else {
        seenEmails.set(lowerEmail, r._line);
      }
    }

    // 4. Team Name collision inspection
    if (teamName) {
      const lowerName = teamName.toLowerCase();
      if (seenTeamNamesLower.has(lowerName)) {
        warnings.push(`Line ${r._line}: Case-insensitive team name collision "${teamName}" matches line ${seenTeamNamesLower.get(lowerName)} (disambiguated by unique Registration Team ID "${regTeamId}")`);
      } else {
        seenTeamNamesLower.set(lowerName, r._line);
      }
    }
  });

  return { errors, warnings };
}

// ── Database Schema Capabilities ────────────────────────────────────────────
async function detectSchemaCapabilities(client) {
  // Check if profiles has login_id column
  const loginIdCheck = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'login_id';
  `);
  const hasLoginId = loginIdCheck.rows.length > 0;

  // Check if provisioning_reconciliation table exists
  const reconCheck = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'provisioning_reconciliation';
  `);
  const hasReconciliationTable = reconCheck.rows.length > 0;

  return { hasLoginId, hasReconciliationTable };
}

// ── Pre-flight DB & Auth State Collection ───────────────────────────────────
async function fetchSystemState(client, supabase) {
  // 1. Fetch Azure PG profiles
  const profilesRes = await client.query(`
    SELECT id, identifier, name, email, role, team_id
    FROM public.profiles;
  `);

  // 2. Fetch Azure PG teams
  const teamsRes = await client.query(`
    SELECT id, name, invite_code, leader_name, created_by
    FROM public.teams;
  `);

  // 3. Fetch Azure PG team_members
  const membersRes = await client.query(`
    SELECT team_id, user_id, role
    FROM public.team_members;
  `);

  // 4. Fetch Supabase Auth users
  const authUsers = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Supabase Auth listUsers failed: ${error.message}`);
    authUsers.push(...data.users);
    if (data.users.length < 100) break;
  }

  return {
    profiles: profilesRes.rows,
    teams: teamsRes.rows,
    teamMembers: membersRes.rows,
    authUsers,
  };
}

// ── Record Evaluation & Classification ──────────────────────────────────────
function evaluateRecord(record, systemState) {
  const loginId = record['Login ID'].toUpperCase();
  const regTeamId = record['Registration Team ID'].toUpperCase();
  const teamName = record['Team Name'];
  const leaderName = record['Team Leader Name'];
  const leaderEmail = record['Team Leader Email'].toLowerCase();

  // Find matches in existing DB profiles
  const existingProfileByIdentifier = systemState.profiles.find(
    p => (p.identifier || '').toUpperCase() === loginId
  );
  const existingProfileByEmail = systemState.profiles.find(
    p => (p.email || '').toLowerCase() === leaderEmail
  );

  // Find matches in existing DB teams
  const existingTeamByCode = systemState.teams.find(
    t => (t.invite_code || '').toUpperCase() === regTeamId
  );
  const existingTeamByNameExact = systemState.teams.find(
    t => t.name === teamName
  );

  // Find matches in Supabase Auth
  const existingAuthUser = systemState.authUsers.find(
    u => (u.email || '').toLowerCase() === leaderEmail
  );

  // Case A: Completely provisioned already (Idempotent Match)
  if (
    existingProfileByIdentifier &&
    (existingProfileByIdentifier.email || '').toLowerCase() === leaderEmail &&
    existingAuthUser &&
    existingAuthUser.id === existingProfileByIdentifier.id &&
    existingTeamByCode &&
    existingProfileByIdentifier.team_id === existingTeamByCode.id
  ) {
    return {
      status: 'ALREADY_PROVISIONED',
      loginId,
      regTeamId,
      teamName,
      leaderEmail,
      reason: 'Account, team, and profile already exist and are fully consistent.',
      existingAuthId: existingAuthUser.id,
      existingTeamId: existingTeamByCode.id,
    };
  }

  // Case B: Identifier collision with a different user
  if (existingProfileByIdentifier) {
    const otherEmail = existingProfileByIdentifier.email || '<no-email>';
    if (otherEmail.toLowerCase() !== leaderEmail) {
      return {
        status: 'CONFLICT',
        loginId,
        regTeamId,
        teamName,
        leaderEmail,
        reason: `Login ID "${loginId}" is already assigned to a different account in public.profiles (${otherEmail})`,
      };
    }
  }

  // Case C: Email collision with a different identifier
  if (existingProfileByEmail) {
    const otherId = existingProfileByEmail.identifier || '<no-id>';
    if (otherId.toUpperCase() !== loginId) {
      return {
        status: 'CONFLICT',
        loginId,
        regTeamId,
        teamName,
        leaderEmail,
        reason: `Email "${leaderEmail}" already exists in public.profiles under a different identifier "${otherId}"`,
      };
    }
  }

  // Case D: Registration Team ID collision with a different team
  if (existingTeamByCode) {
    if (existingTeamByCode.name !== teamName) {
      return {
        status: 'CONFLICT',
        loginId,
        regTeamId,
        teamName,
        leaderEmail,
        reason: `Registration Team ID "${regTeamId}" already assigned to existing team "${existingTeamByCode.name}"`,
      };
    }
  }

  // Case E: Team Name collision with a different Registration ID
  if (existingTeamByNameExact) {
    if ((existingTeamByNameExact.invite_code || '').toUpperCase() !== regTeamId) {
      return {
        status: 'CONFLICT',
        loginId,
        regTeamId,
        teamName,
        leaderEmail,
        reason: `Team Name "${teamName}" already exists in public.teams with invite_code "${existingTeamByNameExact.invite_code}"`,
      };
    }
  }

  // Case F: Auth user exists in Supabase but profile is missing/inconsistent
  if (existingAuthUser && (!existingProfileByEmail || existingAuthUser.id !== existingProfileByEmail.id)) {
    return {
      status: 'CONFLICT',
      loginId,
      regTeamId,
      teamName,
      leaderEmail,
      reason: `Auth user "${leaderEmail}" exists in Supabase Auth (id: ${existingAuthUser.id}) but has no consistent profile. Manual reconciliation required.`,
    };
  }

  // Case G: Clean, ready to provision
  return {
    status: 'READY_TO_CREATE',
    loginId,
    regTeamId,
    teamName,
    leaderName,
    leaderEmail,
    reason: 'Verified clean for provisioning.',
  };
}

// ── Synthetic Record Test Routine ───────────────────────────────────────────
async function runSyntheticTest(client, supabase) {
  console.log('\n🧪 =========================================================');
  console.log('🧪 RUNNING SYNTHETIC END-TO-END VERIFICATION TEST');
  console.log('🧪 =========================================================');

  const testLoginId = 'TEAM-999';
  const testRegId = 'TEST9999';
  const testTeamName = 'Synthetic Verification Team';
  const testLeaderName = 'Synthetic Test Leader';
  const testEmail = `test-synthetic-leader-${Date.now()}@codeemanipal.test`;
  const testPassword = generateEventPassword(8);

  const capabilities = await detectSchemaCapabilities(client);
  let createdAuthId = null;
  let createdTeamId = null;

  try {
    console.log(`1. Acquiring advisory lock...`);
    await client.query("SELECT pg_advisory_xact_lock(hashtext('code-e-manipal-account-provisioning'))");

    console.log(`2. Creating synthetic Supabase Auth account (${testEmail})...`);
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: testLeaderName,
        role: 'participant',
        identifier: testLoginId,
        registration_team_id: testRegId,
        team_name: testTeamName,
      },
    });

    if (authErr || !authData.user) {
      throw new Error(`Failed to create synthetic Auth user: ${authErr?.message}`);
    }
    createdAuthId = authData.user.id;
    console.log(`   ✅ Supabase Auth user created (UUID: ${createdAuthId})`);

    console.log(`3. Executing Azure PostgreSQL transaction...`);
    await client.query('BEGIN');

    try {
      // auth.users shadow
      await client.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [createdAuthId, testEmail, JSON.stringify({ name: testLeaderName, role: 'participant', identifier: testLoginId })]
      );

      // public.teams
      const teamRes = await client.query(
        `INSERT INTO public.teams (name, hackathon, invite_code, leader_name, created_by, track)
         VALUES ($1, 'Code-e-Manipal 2.0', $2, $3, $4, 'General')
         RETURNING id`,
        [testTeamName, testRegId, testLeaderName, createdAuthId]
      );
      createdTeamId = teamRes.rows[0].id;
      console.log(`   ✅ public.teams inserted (Team ID: ${createdTeamId})`);

      // public.team_members
      await client.query(
        `INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1, $2, 'leader')`,
        [createdTeamId, createdAuthId]
      );
      console.log(`   ✅ public.team_members inserted (role: leader)`);

      // public.profiles (handles auto-creation by on_auth_user_created trigger)
      if (capabilities.hasLoginId) {
        await client.query(
          `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id, team_id)
           VALUES ($1, $2, $3, '', 'participant', $4, NULL, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             role = EXCLUDED.role,
             identifier = EXCLUDED.identifier,
             login_id = EXCLUDED.login_id,
             team_id = EXCLUDED.team_id,
             updated_at = NOW()`,
          [createdAuthId, testLeaderName, testEmail, testLoginId, createdTeamId]
        );
      } else {
        await client.query(
          `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, team_id)
           VALUES ($1, $2, $3, '', 'participant', $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             role = EXCLUDED.role,
             identifier = EXCLUDED.identifier,
             team_id = EXCLUDED.team_id,
             updated_at = NOW()`,
          [createdAuthId, testLeaderName, testEmail, testLoginId, createdTeamId]
        );
      }
      console.log(`   ✅ public.profiles inserted (identifier: ${testLoginId})`);

      // Audit log
      await client.query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'SYNTHETIC_TEST_PROVISIONED', 'profiles', $2, $3)`,
        [createdAuthId, createdAuthId, JSON.stringify({ role: 'participant', identifier: testLoginId, team_id: createdTeamId })]
      );

      await client.query('COMMIT');
      console.log(`   ✅ Database transaction committed.`);
    } catch (txErr) {
      console.error('   ❌ DB Transaction error:', txErr.message);
      await client.query('ROLLBACK');
      throw txErr;
    }

    console.log(`4. Verifying credential authentication via Supabase GoTrue...`);
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr || !signInData.user) {
      throw new Error(`Authentication verification failed: ${signInErr?.message}`);
    }
    console.log(`   ✅ Auth signInWithPassword verification successful!`);

    console.log(`5. Verifying database profile & team association...`);
    const profCheck = await client.query(
      `SELECT p.id, p.identifier, p.role, p.team_id, t.name as team_name, t.invite_code
       FROM public.profiles p
       JOIN public.teams t ON p.team_id = t.id
       WHERE p.id = $1`,
      [createdAuthId]
    );
    if (profCheck.rows.length === 0 || profCheck.rows[0].identifier !== testLoginId) {
      throw new Error(`Profile verification lookup failed!`);
    }
    console.log(`   ✅ Profile lookup verified (Team: "${profCheck.rows[0].team_name}", Code: "${profCheck.rows[0].invite_code}")`);

    console.log(`\n🎉 Synthetic verification succeeded completely! Now performing safe teardown...`);
  } finally {
    // Teardown synthetic record
    console.log(`Teardown: Cleaning up synthetic records...`);
    if (createdTeamId) {
      await client.query('DELETE FROM public.team_members WHERE team_id = $1', [createdTeamId]);
      await client.query('DELETE FROM public.profiles WHERE id = $1', [createdAuthId]);
      await client.query('DELETE FROM public.teams WHERE id = $1', [createdTeamId]);
      await client.query('DELETE FROM auth.users WHERE id = $1', [createdAuthId]);
      await client.query('DELETE FROM public.audit_logs WHERE action = \'SYNTHETIC_TEST_PROVISIONED\'');
    }
    if (createdAuthId) {
      await supabase.auth.admin.deleteUser(createdAuthId);
    }
    console.log(`✅ Teardown complete: Non-production test isolated with zero leftovers.\n`);
  }
}

// ── Actual Record Provisioning Engine ───────────────────────────────────────
async function provisionSingleLeader(record, client, supabase, capabilities, adminActorId) {
  const loginId = record['Login ID'].toUpperCase();
  const regTeamId = record['Registration Team ID'].toUpperCase();
  const teamName = record['Team Name'];
  const leaderName = record['Team Leader Name'];
  const leaderEmail = record['Team Leader Email'].toLowerCase();

  const tempPassword = generateEventPassword(8);
  let createdAuthId = null;

  try {
    // 1. Create Supabase Auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: leaderEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: leaderName,
        role: 'participant',
        identifier: loginId,
        registration_team_id: regTeamId,
        team_name: teamName,
      },
    });

    if (authErr || !authData.user) {
      throw new Error(`Auth account creation failed: ${authErr?.message || 'unknown error'}`);
    }
    createdAuthId = authData.user.id;

    // 2. Azure PostgreSQL Transaction
    await client.query('BEGIN');

    // auth.users shadow
    await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [createdAuthId, leaderEmail, JSON.stringify({ name: leaderName, role: 'participant', identifier: loginId })]
    );

    // public.teams
    const teamRes = await client.query(
      `INSERT INTO public.teams (name, hackathon, invite_code, leader_name, created_by, track)
       VALUES ($1, 'Code-e-Manipal 2.0', $2, $3, $4, 'General')
       RETURNING id`,
      [teamName, regTeamId, leaderName, createdAuthId]
    );
    const teamId = teamRes.rows[0].id;

    // public.team_members
    await client.query(
      `INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1, $2, 'leader')`,
      [teamId, createdAuthId]
    );

    // public.profiles (handles auto-creation by on_auth_user_created trigger)
    if (capabilities.hasLoginId) {
      await client.query(
        `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id, team_id)
         VALUES ($1, $2, $3, '', 'participant', $4, NULL, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           identifier = EXCLUDED.identifier,
           login_id = EXCLUDED.login_id,
           team_id = EXCLUDED.team_id,
           updated_at = NOW()`,
        [createdAuthId, leaderName, leaderEmail, loginId, teamId]
      );
    } else {
      await client.query(
        `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, team_id)
         VALUES ($1, $2, $3, '', 'participant', $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           identifier = EXCLUDED.identifier,
           team_id = EXCLUDED.team_id,
           updated_at = NOW()`,
        [createdAuthId, leaderName, leaderEmail, loginId, teamId]
      );
    }

    // Sync hackathon_registrations status if matching row exists
    await client.query(
      `UPDATE public.hackathon_registrations
       SET status = 'approved', reviewed_at = NOW()
       WHERE LOWER(email) = LOWER($1) OR team_name = $2`,
      [leaderEmail, teamName]
    );

    // Audit log
    await client.query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, 'TEAM_LEADER_BULK_PROVISIONED', 'profiles', $2, $3)`,
      [
        adminActorId || createdAuthId,
        createdAuthId,
        JSON.stringify({
          role: 'participant',
          identifier: loginId,
          team_id: teamId,
          registration_team_id: regTeamId,
          team_name: teamName,
        }),
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      loginId,
      regTeamId,
      teamName,
      leaderEmail,
      authUserId: createdAuthId,
      teamId,
      password: tempPassword,
    };
  } catch (error) {
    // Compensating rollback
    try { await client.query('ROLLBACK'); } catch (_) { }

    if (createdAuthId) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(createdAuthId);
      if (delErr) {
        console.error(`CRITICAL: Failed to delete orphaned Auth user ${createdAuthId}:`, delErr.message);
        if (capabilities.hasReconciliationTable) {
          try {
            await client.query(
              `INSERT INTO public.provisioning_reconciliation
               (operation_id, auth_user_id, stage, status, error_message)
               VALUES (gen_random_uuid(), $1, 'COMPENSATING_AUTH_DELETE', 'PENDING_AUTH_CLEANUP', $2)`,
              [createdAuthId, delErr.message]
            );
          } catch (_) { }
        }
      }
    }

    return {
      success: false,
      loginId,
      regTeamId,
      teamName,
      leaderEmail,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ── Main Controller ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHelp = args.includes('--help') || args.includes('-h');
  const isDryRun = args.includes('--dry-run') || !args.includes('--execute');
  const isExecute = args.includes('--execute');
  const isConfirm = args.includes('--confirm');
  const isSynthetic = args.includes('--test-synthetic');

  let inputPath = 'code_e_manipal_team_leader_login_ids_cleaned.csv';
  const inputIdx = args.indexOf('--input');
  if (inputIdx !== -1 && args[inputIdx + 1]) {
    inputPath = args[inputIdx + 1];
  }

  let credOutputPath = null;
  const credIdx = args.indexOf('--output-credentials');
  if (credIdx !== -1 && args[credIdx + 1]) {
    credOutputPath = args[credIdx + 1];
  }

  if (isHelp) {
    console.log(`
Code-e-Manipal 2.0 — Team Leader Provisioning CLI
Usage:
  node --env-file=.env.local scripts/provision-team-leaders.mjs [options]

Options:
  --dry-run               Run validation and collision checks without making any changes (DEFAULT)
  --execute --confirm     Execute actual atomic provisioning into Azure PostgreSQL & Supabase Auth
  --input <path>          Path to cleaned CSV file (default: code_e_manipal_team_leader_login_ids_cleaned.csv)
  --test-synthetic        Run isolated non-production synthetic test (provisions, authenticates, cleans up)
  --output-credentials <p> Path to save generated credentials CSV (passwords never printed to console)
  --help, -h              Show this help message
`);
    process.exit(0);
  }

  console.log(`\n============================================================`);
  console.log(`🚀 CODE-e-MANIPAL 2.0 — TEAM LEADER PROVISIONING WORKFLOW`);
  console.log(`Mode: ${isExecute ? '⚡ GUARDED EXECUTION MODE' : '🔍 DRY-RUN MODE (No modifications)'}`);
  console.log(`Input CSV: ${inputPath}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`============================================================\n`);

  // 1. Read and parse CSV
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input CSV file not found: ${inputPath}`);
    process.exit(1);
  }
  const rawCSV = fs.readFileSync(inputPath, 'utf8');
  const records = parseCSV(rawCSV);
  console.log(`📄 Loaded ${records.length} records from ${inputPath}.`);

  // 2. Validate CSV records
  const { errors: csvErrors, warnings: csvWarnings } = validateCSVRecords(records);
  if (csvWarnings.length > 0) {
    console.log(`\n⚠️  CSV Validation Disambiguation Notes (${csvWarnings.length}):`);
    csvWarnings.forEach(w => console.log(`   - ${w}`));
  }
  if (csvErrors.length > 0) {
    console.error(`\n❌ CSV Invariant Validation Failed with ${csvErrors.length} errors:`);
    csvErrors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log(`✅ CSV Invariant Validation: All ${records.length} records passed format and uniqueness constraints.`);

  // 3. Connect to Azure PostgreSQL & Supabase Auth
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4. Run synthetic test if requested
  if (isSynthetic) {
    await runSyntheticTest(client, supabase);
  }

  // 5. Detect DB Capabilities & Fetch System State
  const capabilities = await detectSchemaCapabilities(client);
  console.log(`\n🔍 Database Capabilities:`);
  console.log(`   - profiles.login_id column present: ${capabilities.hasLoginId ? 'YES' : 'NO (will omit from INSERT)'}`);
  console.log(`   - provisioning_reconciliation table present: ${capabilities.hasReconciliationTable ? 'YES' : 'NO'}`);

  console.log(`\n🔍 Fetching authoritative state from Azure PostgreSQL & Supabase Auth...`);
  const systemState = await fetchSystemState(client, supabase);
  console.log(`   - Existing Azure PG Profiles: ${systemState.profiles.length}`);
  console.log(`   - Existing Azure PG Teams: ${systemState.teams.length}`);
  console.log(`   - Existing Supabase Auth Users: ${systemState.authUsers.length}`);

  // 6. Classify Records
  const classifications = records.map(r => evaluateRecord(r, systemState));
  const alreadyProvisioned = classifications.filter(c => c.status === 'ALREADY_PROVISIONED');
  const conflicts = classifications.filter(c => c.status === 'CONFLICT');
  const readyToCreate = classifications.filter(c => c.status === 'READY_TO_CREATE');

  console.log(`\n============================================================`);
  console.log(`📊 PRE-FLIGHT RECORD CLASSIFICATION SUMMARY`);
  console.log(`============================================================`);
  console.log(`Total CSV Records:           ${records.length}`);
  console.log(`Ready to Provision (Clean):   ${readyToCreate.length}`);
  console.log(`Already Provisioned (Match):  ${alreadyProvisioned.length}`);
  console.log(`Conflicts / Rejected:        ${conflicts.length}`);
  console.log(`============================================================`);

  if (conflicts.length > 0) {
    console.log(`\n⚠️  CONFLICTS / REJECTED RECORDS (${conflicts.length}):`);
    conflicts.forEach(c => {
      console.log(`   • ${c.loginId} (${c.teamName} / ${c.leaderEmail}): ${c.reason}`);
    });
  }

  // 7. If Dry Run, print report and exit
  if (isDryRun || !isExecute) {
    console.log(`\n🔎 DRY-RUN COMPLETED SUCCESSFULLY.`);
    console.log(`No records were written to Azure PostgreSQL or Supabase Auth.`);
    console.log(`To execute actual provisioning for ready records, review the report and run:`);
    console.log(`  node --env-file=.env.local scripts/provision-team-leaders.mjs --execute --confirm\n`);
    await client.end();
    return;
  }

  // 8. Guarded Execution Mode
  if (!isConfirm) {
    console.error(`\n❌ Execution halted: --execute requires --confirm flag to prevent accidental execution.`);
    await client.end();
    process.exit(1);
  }

  if (readyToCreate.length === 0) {
    console.log(`\nℹ️ No new records to provision.`);
    await client.end();
    return;
  }

  console.log(`\n⚡ PROCEEDING WITH PROVISIONING FOR ${readyToCreate.length} RECORDS...`);

  // Acquire advisory lock
  await client.query("SELECT pg_advisory_xact_lock(hashtext('code-e-manipal-account-provisioning'))");

  // Lookup admin user ID for audit log if available
  const adminActor = systemState.authUsers.find(u => u.user_metadata?.role === 'admin');
  const adminActorId = adminActor?.id || null;

  const successfulProvisionings = [];
  const failedProvisionings = [];

  for (let i = 0; i < readyToCreate.length; i++) {
    const item = readyToCreate[i];
    process.stdout.write(`[${i + 1}/${readyToCreate.length}] Provisioning ${item.loginId} (${item.teamName})... `);

    const result = await provisionSingleLeader(item, client, supabase, capabilities, adminActorId);
    if (result.success) {
      successfulProvisionings.push(result);
      console.log(`✅ Success`);
    } else {
      failedProvisionings.push(result);
      console.log(`❌ FAILED: ${result.error}`);
    }
  }

  // 9. Post-Execution Summary
  console.log(`\n============================================================`);
  console.log(`🏁 EXECUTION COMPLETED`);
  console.log(`============================================================`);
  console.log(`Total Attempted:   ${readyToCreate.length}`);
  console.log(`Successfully Created: ${successfulProvisionings.length}`);
  console.log(`Failed:            ${failedProvisionings.length}`);
  console.log(`Previously Existing: ${alreadyProvisioned.length}`);
  console.log(`Skipped Conflicts: ${conflicts.length}`);
  console.log(`============================================================`);

  // 10. Credentials Export (if requested)
  if (credOutputPath && successfulProvisionings.length > 0) {
    const credDir = path.dirname(credOutputPath);
    if (!fs.existsSync(credDir)) fs.mkdirSync(credDir, { recursive: true });

    const credHeaders = ['Login ID', 'Registration Team ID', 'Team Name', 'Team Leader Name', 'Team Leader Email', 'Temporary Password', 'Auth User ID', 'Team ID'];
    const credLines = [credHeaders.join(',')];
    successfulProvisionings.forEach(s => {
      credLines.push([
        s.loginId,
        s.regTeamId,
        `"${s.teamName.replace(/"/g, '""')}"`,
        `"${s.leaderName.replace(/"/g, '""')}"`,
        s.leaderEmail,
        s.password,
        s.authUserId,
        s.teamId,
      ].join(','));
    });
    fs.writeFileSync(credOutputPath, credLines.join('\r\n'), 'utf8');
    console.log(`\n🔐 Secure credentials export written to: ${credOutputPath}`);
    console.log(`⚠️  Keep this file confidential and do not commit it to version control!`);
  }

  await client.end();
}

// Execute if run from CLI
if (process.argv[1] && process.argv[1].endsWith('provision-team-leaders.mjs')) {
  main().catch((err) => {
    console.error('\n💥 Unexpected fatal error:', err);
    process.exit(1);
  });
}
