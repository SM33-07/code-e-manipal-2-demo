#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Production Account Reconciliation & Provisioning
 * File: scripts/reconcile-production-accounts.mjs
 *
 * Reconciles 87 official participant teams and 10 official judges into:
 *  - Production Supabase Auth: ihnclawnbtkwvbfqwxfe
 *  - Production Azure PostgreSQL: code-e-manipal-db.postgres.database.azure.com / postgres
 *
 * Hard Invariants:
 *  1. Preserves existing 3 production admins (soham, yash, abhinav) untouched.
 *  2. Preserves exact distributed passcodes from authoritative files.
 *  3. Reuses existing profiles and UUIDs where matching; zero duplicates.
 *  4. Transactional database updates; zero plaintext passcode logs.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

// ── Parse .env.local ──────────────────────────────────────────────────────────
const envLocalPath = path.resolve('.env.local');
if (!fs.existsSync(envLocalPath)) {
  console.error('❌ .env.local not found.');
  process.exit(1);
}

const env = {};
fs.readFileSync(envLocalPath, 'utf8').split('\n').forEach(l => {
  const trimmed = l.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[trimmed.slice(0, idx).trim()] = val;
  }
});

const dbUrl = env.DATABASE_URL;
const sbUrl = env.SUPABASE_URL;
const sbKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl || !sbUrl || !sbKey) {
  console.error('❌ DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

// ── Strict Target Environment Validation ─────────────────────────────────────
const expectedSbRef = 'ihnclawnbtkwvbfqwxfe';
const expectedDbName = 'postgres';

let parsedDbHost = '', parsedDbName = '', parsedSbHost = '';
try {
  const uDb = new URL(dbUrl);
  parsedDbHost = uDb.host;
  parsedDbName = uDb.pathname.replace(/^\//, '').split('?')[0];
  const uSb = new URL(sbUrl);
  parsedSbHost = uSb.host;
} catch (e) {
  console.error('❌ Error parsing URLs:', e.message);
  process.exit(1);
}

if (!parsedSbHost.includes(expectedSbRef) || parsedDbName !== expectedDbName) {
  console.error('❌ FATAL SECURITY ABORT: Target is NOT production!');
  console.error(`   Supabase: ${parsedSbHost} (Expected ref: ${expectedSbRef})`);
  console.error(`   Database: ${parsedDbName} (Expected: ${expectedDbName})`);
  process.exit(1);
}

// ── CLI Flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const confirmYes = args.includes('--confirm') && args[args.indexOf('--confirm') + 1] === 'yes';

console.log('================================================================');
console.log('  Code-e-Manipal 2.0 — Production Account Reconciliation');
console.log('================================================================');
console.log(`Target Supabase: ${parsedSbHost}`);
console.log(`Target Database: ${parsedDbHost} / ${parsedDbName}`);
console.log(`Execution Mode:  ${isExecute ? 'EXECUTE (Mutations enabled)' : 'DRY-RUN (Zero writes)'}`);
console.log('----------------------------------------------------------------\n');

// ── Load Authoritative Credential Sources ─────────────────────────────────────
const teamCredJsonPath = path.resolve('.credentials/official_event_team_credentials.json');
if (!fs.existsSync(teamCredJsonPath)) {
  console.error(`❌ Team credentials file missing: ${teamCredJsonPath}`);
  process.exit(1);
}
const officialTeams = JSON.parse(fs.readFileSync(teamCredJsonPath, 'utf8'));
if (officialTeams.length < 86) {
  console.error(`❌ Expected at least 86 teams in ${teamCredJsonPath}, found ${officialTeams.length}`);
  process.exit(1);
}

const judgeXlsxPath = path.resolve('.credentials/official_code_e_manipal_judge_credentials.xlsx');
if (!fs.existsSync(judgeXlsxPath)) {
  console.error(`❌ Judge credentials file missing: ${judgeXlsxPath}`);
  process.exit(1);
}
const wb = xlsx.readFile(judgeXlsxPath);
const officialJudges = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
if (officialJudges.length !== 10) {
  console.error(`❌ Expected exactly 10 judges in ${judgeXlsxPath}, found ${officialJudges.length}`);
  process.exit(1);
}

console.log(`✓ Loaded ${officialTeams.length} authoritative participant teams from JSON.`);
console.log(`✓ Loaded ${officialJudges.length} authoritative judges from XLSX.\n`);

// Rate limit helper for Supabase API calls
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const pgClient = await pool.connect();
  const supabase = createClient(sbUrl, sbKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    // 1. Fetch current production state
    console.log('1. Auditing current production environment state...');

    // A. Supabase Auth Users
    const authUsers = [];
    for (let page = 1; page <= 30; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error(`Supabase listUsers failed: ${error.message}`);
      authUsers.push(...data.users);
      if (data.users.length < 100) break;
    }
    console.log(`   - Current Supabase Auth users: ${authUsers.length}`);

    // B. PostgreSQL Tables
    const { rows: profiles } = await pgClient.query('SELECT * FROM public.profiles');
    const { rows: teams } = await pgClient.query('SELECT * FROM public.teams');
    const { rows: teamMembers } = await pgClient.query('SELECT * FROM public.team_members');

    console.log(`   - Current public.profiles:      ${profiles.length}`);
    console.log(`   - Current public.teams:         ${teams.length}`);
    console.log(`   - Current public.team_members:  ${teamMembers.length}`);

    // C. Verify & Lock 3 Protected Admins
    const protectedAdminEmails = [
      'sohammore3312@gmail.com',
      'yashsrivastava3745@gmail.com',
      'abhinav.ong@gmail.com',
    ];

    const activeAdmins = authUsers.filter((u) =>
      protectedAdminEmails.includes(u.email?.toLowerCase())
    );
    if (activeAdmins.length !== 3) {
      throw new Error(`Expected exactly 3 active admins in Supabase Auth, found ${activeAdmins.length}`);
    }

    console.log('\n🔒 Verified Protected Admins (Will NOT be modified):');
    activeAdmins.forEach((a) => {
      console.log(`   - [ADMIN] ID: ${a.id} | Email: ${a.email}`);
    });

    // Lookup indexes
    const authById = new Map(authUsers.map((u) => [u.id, u]));
    const authByEmail = new Map(authUsers.map((u) => [u.email.toLowerCase(), u]));

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const profileByLoginId = new Map(profiles.filter((p) => p.login_id).map((p) => [p.login_id.toUpperCase(), p]));
    const profileByIdentifier = new Map(profiles.filter((p) => p.identifier).map((p) => [p.identifier.toUpperCase(), p]));
    const profileByEmail = new Map(profiles.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]));

    const teamByName = new Map(teams.map((t) => [t.name.trim().toLowerCase(), t]));
    const teamByInviteCode = new Map(teams.filter((t) => t.invite_code).map((t) => [t.invite_code.toUpperCase(), t]));

    // 2. Classify Participant Teams
    console.log('\n2. Classifying 87 Participant Teams against current state...');
    const teamReconciliationList = [];
    for (const teamCred of officialTeams) {
      const {
        teamId,
        loginId,
        canonicalIdentifier,
        teamName,
        contactName,
        authEmail,
        officialPasscode,
      } = teamCred;

      // Check existing auth by email
      const existingAuth = authByEmail.get(authEmail.toLowerCase()) || null;

      // Check existing profile by login_id, identifier, or email
      const existingProfile =
        profileByLoginId.get(loginId.toUpperCase()) ||
        profileByIdentifier.get(canonicalIdentifier.toUpperCase()) ||
        profileByEmail.get(authEmail.toLowerCase()) ||
        (existingAuth ? profileById.get(existingAuth.id) : null) ||
        null;

      // Check existing team by name or invite_code
      const existingTeam =
        teamByName.get(teamName.trim().toLowerCase()) ||
        teamByInviteCode.get(teamId.toUpperCase()) ||
        null;

      teamReconciliationList.push({
        teamId,
        loginId,
        canonicalIdentifier,
        teamName,
        contactName,
        authEmail,
        officialPasscode,
        existingAuth,
        existingProfile,
        existingTeam,
      });
    }

    // 3. Classify Judges
    console.log('3. Classifying 10 Judges against current state...');
    const judgeReconciliationList = [];
    for (const j of officialJudges) {
      const slot = j.Slot;
      const name = j['Judge Name'];
      const loginId = j['Login ID'];
      const identifier = j['Badge / Canonical ID'];
      const email = j['System Email'];
      const passcode = j['Passcode (8-Digit)'];

      const existingAuth = authByEmail.get(email.toLowerCase()) || null;
      const existingProfile =
        profileByLoginId.get(loginId.toUpperCase()) ||
        profileByIdentifier.get(identifier.toUpperCase()) ||
        profileByEmail.get(email.toLowerCase()) ||
        (existingAuth ? profileById.get(existingAuth.id) : null) ||
        null;

      judgeReconciliationList.push({
        slot,
        name,
        loginId,
        identifier,
        email,
        passcode,
        existingAuth,
        existingProfile,
      });
    }

    const teamsToCreateAuth = teamReconciliationList.filter((t) => !t.existingAuth).length;
    const teamsToUpdateAuth = teamReconciliationList.filter((t) => t.existingAuth).length;
    const judgesToCreateAuth = judgeReconciliationList.filter((j) => !j.existingAuth).length;
    const judgesToUpdateAuth = judgeReconciliationList.filter((j) => j.existingAuth).length;

    console.log('\n--- Reconciliation Summary ---');
    console.log(`- Participant Teams: ${teamReconciliationList.length}`);
    console.log(`  * Supabase Auth users to create: ${teamsToCreateAuth}`);
    console.log(`  * Supabase Auth users to update: ${teamsToUpdateAuth}`);
    console.log(`- Judges: ${judgeReconciliationList.length}`);
    console.log(`  * Supabase Auth users to create: ${judgesToCreateAuth}`);
    console.log(`  * Supabase Auth users to update: ${judgesToUpdateAuth}`);

    if (!isExecute) {
      console.log('\n================================================================');
      console.log('✅ DRY-RUN AUDIT COMPLETE (Zero writes performed).');
      console.log('   To execute reconciliation against production, run:');
      console.log('   node scripts/reconcile-production-accounts.mjs --execute --confirm yes');
      console.log('================================================================');
      return;
    }

    if (!confirmYes) {
      console.error('❌ Execution aborted: --confirm yes flag is required with --execute.');
      process.exit(1);
    }

    // ── EXECUTE MUTATIONS ───────────────────────────────────────────────────
    console.log('\n🚀 EXECUTING PRODUCTION RECONCILIATION...');
    const auditLog = [];

    let teamAuthCreated = 0;
    let teamAuthReused = 0;
    let teamProfilesUpserted = 0;
    let teamsUpserted = 0;
    let teamFailures = 0;

    let judgeAuthCreated = 0;
    let judgeAuthReused = 0;
    let judgeProfilesUpserted = 0;
    let judgeFailures = 0;

    // ── Phase A: Reconcile Participant Teams ───────────────────────────────
    console.log('\n--- Processing 87 Participant Teams ---');
    for (let i = 0; i < teamReconciliationList.length; i++) {
      const item = teamReconciliationList[i];
      let authUserId = null;

      try {
        // Step A.1: Supabase Auth
        if (item.existingAuth) {
          authUserId = item.existingAuth.id;
          const { error: updErr } = await supabase.auth.admin.updateUserById(authUserId, {
            password: item.officialPasscode,
            email_confirm: true,
            user_metadata: {
              name: item.contactName,
              role: 'participant',
              identifier: item.canonicalIdentifier,
              login_id: item.loginId,
              team_name: item.teamName,
            },
          });
          if (updErr) throw new Error(`Auth update failed: ${updErr.message}`);
          teamAuthReused++;
        } else {
          // Check if an existing profile UUID can be reused
          const createPayload = {
            email: item.authEmail,
            password: item.officialPasscode,
            email_confirm: true,
            user_metadata: {
              name: item.contactName,
              role: 'participant',
              identifier: item.canonicalIdentifier,
              login_id: item.loginId,
              team_name: item.teamName,
            },
          };
          if (item.existingProfile?.id) {
            createPayload.id = item.existingProfile.id;
          }

          const { data: createData, error: createErr } = await supabase.auth.admin.createUser(createPayload);
          if (createErr || !createData?.user) {
            throw new Error(`Auth create failed: ${createErr?.message}`);
          }
          authUserId = createData.user.id;
          teamAuthCreated++;
        }

        // Rate-limit pause for Supabase Auth API
        await sleep(60);

        // Step A.2: PostgreSQL Transaction
        await pgClient.query('BEGIN');

        // Shadow auth.users
        await pgClient.query(
          `INSERT INTO auth.users (id, email, raw_user_meta_data)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
          [
            authUserId,
            item.authEmail,
            JSON.stringify({
              name: item.contactName,
              role: 'participant',
              identifier: item.canonicalIdentifier,
              login_id: item.loginId,
              team_name: item.teamName,
            }),
          ]
        );

        // Upsert public.teams
        let teamDbId = null;
        if (item.existingTeam?.id) {
          teamDbId = item.existingTeam.id;
          await pgClient.query(
            `UPDATE public.teams
             SET name = $1, invite_code = $2, leader_name = $3, updated_at = NOW()
             WHERE id = $4`,
            [item.teamName, item.teamId, item.contactName, teamDbId]
          );
        } else {
          const { rows: tRows } = await pgClient.query(
            `INSERT INTO public.teams (name, hackathon, invite_code, leader_name, created_by, track)
             VALUES ($1, 'Code-e-Manipal 2.0', $2, $3, $4, 'General')
             ON CONFLICT (name) DO UPDATE SET
               invite_code = EXCLUDED.invite_code,
               leader_name = EXCLUDED.leader_name,
               updated_at = NOW()
             RETURNING id`,
            [item.teamName, item.teamId, item.contactName, authUserId]
          );
          teamDbId = tRows[0].id;
        }
        teamsUpserted++;

        // Upsert public.team_members
        await pgClient.query(
          `INSERT INTO public.team_members (team_id, user_id, role, joined_at)
           VALUES ($1, $2, 'leader', NOW())
           ON CONFLICT (team_id, user_id) DO NOTHING`,
          [teamDbId, authUserId]
        );

        // Upsert public.profiles
        // If an existing profile had a colliding identifier/login_id with a different UUID, clean it safely
        await pgClient.query(
          `DELETE FROM public.profiles 
           WHERE id != $1 AND (UPPER(TRIM(identifier)) = $2 OR UPPER(TRIM(COALESCE(login_id, ''))) = $3)`,
          [authUserId, item.canonicalIdentifier.toUpperCase(), item.loginId.toUpperCase()]
        );

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
          [authUserId, item.contactName, item.authEmail, item.canonicalIdentifier, item.loginId, teamDbId]
        );

        await pgClient.query('COMMIT');
        teamProfilesUpserted++;

        auditLog.push({
          teamId: item.teamId,
          type: 'participant',
          authUserId,
          status: 'SUCCESS',
        });
      } catch (err) {
        await pgClient.query('ROLLBACK').catch(() => {});
        teamFailures++;
        console.error(`   ❌ Failed team ${item.teamId} (${item.teamName}): ${err.message}`);
        auditLog.push({
          teamId: item.teamId,
          type: 'participant',
          status: 'FAILED',
          error: err.message,
        });
      }
    }
    console.log(`✓ Participant teams processed: ${teamProfilesUpserted} succeeded, ${teamFailures} failed.`);

    // ── Phase B: Reconcile Judges ──────────────────────────────────────────
    console.log('\n--- Processing 10 Official Judges ---');
    for (let i = 0; i < judgeReconciliationList.length; i++) {
      const item = judgeReconciliationList[i];
      let authUserId = null;

      try {
        // Step B.1: Supabase Auth
        if (item.existingAuth) {
          authUserId = item.existingAuth.id;
          const { error: updErr } = await supabase.auth.admin.updateUserById(authUserId, {
            password: item.passcode,
            email_confirm: true,
            user_metadata: {
              name: item.name,
              role: 'judge',
              identifier: item.identifier,
              login_id: item.loginId,
            },
          });
          if (updErr) throw new Error(`Judge auth update failed: ${updErr.message}`);
          judgeAuthReused++;
        } else {
          const createPayload = {
            email: item.email,
            password: item.passcode,
            email_confirm: true,
            user_metadata: {
              name: item.name,
              role: 'judge',
              identifier: item.identifier,
              login_id: item.loginId,
            },
          };
          if (item.existingProfile?.id) {
            createPayload.id = item.existingProfile.id;
          }

          const { data: createData, error: createErr } = await supabase.auth.admin.createUser(createPayload);
          if (createErr || !createData?.user) {
            throw new Error(`Judge auth create failed: ${createErr?.message}`);
          }
          authUserId = createData.user.id;
          judgeAuthCreated++;
        }

        // Rate-limit pause
        await sleep(60);

        // Step B.2: PostgreSQL Transaction
        await pgClient.query('BEGIN');

        // Shadow auth.users
        await pgClient.query(
          `INSERT INTO auth.users (id, email, raw_user_meta_data)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
          [
            authUserId,
            item.email,
            JSON.stringify({
              name: item.name,
              role: 'judge',
              identifier: item.identifier,
              login_id: item.loginId,
            }),
          ]
        );

        // Remove any stale colliding profile row with different UUID
        await pgClient.query(
          `DELETE FROM public.profiles 
           WHERE id != $1 AND (UPPER(TRIM(identifier)) = $2 OR UPPER(TRIM(COALESCE(login_id, ''))) = $3)`,
          [authUserId, item.identifier.toUpperCase(), item.loginId.toUpperCase()]
        );

        // Upsert public.profiles
        await pgClient.query(
          `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id, team_id, is_disabled, force_logout_before)
           VALUES ($1, $2, $3, '', 'judge', $4, $5, NULL, false, NULL)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             role = 'judge',
             identifier = EXCLUDED.identifier,
             login_id = EXCLUDED.login_id,
             team_id = NULL,
             is_disabled = false,
             force_logout_before = NULL,
             updated_at = NOW()`,
          [authUserId, item.name, item.email, item.identifier, item.loginId]
        );

        await pgClient.query('COMMIT');
        judgeProfilesUpserted++;

        auditLog.push({
          slot: item.slot,
          type: 'judge',
          authUserId,
          status: 'SUCCESS',
        });
      } catch (err) {
        await pgClient.query('ROLLBACK').catch(() => {});
        judgeFailures++;
        console.error(`   ❌ Failed judge Slot ${item.slot} (${item.name}): ${err.message}`);
        auditLog.push({
          slot: item.slot,
          type: 'judge',
          status: 'FAILED',
          error: err.message,
        });
      }
    }
    console.log(`✓ Judges processed: ${judgeProfilesUpserted} succeeded, ${judgeFailures} failed.`);

    // ── Post-Reconciliation Verification ────────────────────────────────────
    console.log('\n================================================================');
    console.log('       POST-RECONCILIATION VERIFICATION REPORT                  ');
    console.log('================================================================');

    const { rows: finalProfiles } = await pgClient.query('SELECT role, COUNT(*)::int as count FROM public.profiles GROUP BY role');
    console.log('Final Profiles breakdown in Azure PostgreSQL:');
    finalProfiles.forEach((r) => console.log(`  - ${r.role}: ${r.count}`));

    const { rows: finalTeams } = await pgClient.query('SELECT COUNT(*)::int as count FROM public.teams');
    console.log(`Final Teams count in Azure PostgreSQL: ${finalTeams[0].count}`);

    // Verify 3 admins still intact
    const { rows: adminCheck } = await pgClient.query("SELECT id, name, email, login_id FROM public.profiles WHERE role = 'admin'");
    console.log(`\nProtected Admin Profiles (${adminCheck.length}):`);
    adminCheck.forEach((a) => console.log(`  - ${a.login_id} (${a.email}) [UUID: ${a.id}]`));

    // Sample Identifier Resolution Test in Database
    console.log('\nSample Identifier Resolution Checks:');
    const testIds = ['TEAM001', 'TEAM-001', 'TEAM087', 'TEAM-087', 'judge1', 'judge10', 'soham'];
    for (const tid of testIds) {
      const { rows } = await pgClient.query(
        `SELECT id, name, email, role, login_id, identifier, team_id FROM public.profiles
         WHERE UPPER(TRIM(COALESCE(login_id, ''))) = $1
            OR UPPER(TRIM(identifier)) = $1
         LIMIT 1`,
        [tid.toUpperCase()]
      );
      if (rows.length > 0) {
        console.log(`  ✓ Resolved '${tid}' -> Name: "${rows[0].name}", Role: ${rows[0].role}, ProfileID: ${rows[0].id}`);
      } else {
        console.log(`  ❌ Failed to resolve '${tid}'`);
      }
    }

    console.log('\n================================================================');
    console.log(`TOTAL STATS:`);
    console.log(`- Participant Teams Created/Reconciled: ${teamProfilesUpserted} / ${teamReconciliationList.length}`);
    console.log(`- Judges Created/Reconciled:           ${judgeProfilesUpserted} / ${judgeReconciliationList.length}`);
    console.log(`- Failures:                            ${teamFailures + judgeFailures}`);
    console.log('================================================================');

    // Save audit log to local scratch file without secrets
    const auditSummary = {
      timestamp: new Date().toISOString(),
      targetSb: parsedSbHost,
      targetDb: parsedDbName,
      stats: {
        teamAuthCreated,
        teamAuthReused,
        teamProfilesUpserted,
        teamFailures,
        judgeAuthCreated,
        judgeAuthReused,
        judgeProfilesUpserted,
        judgeFailures,
      },
      auditLog,
    };
    fs.writeFileSync('.credentials/production_reconciliation_audit.json', JSON.stringify(auditSummary, null, 2));
    console.log('Auditable reconciliation summary saved to .credentials/production_reconciliation_audit.json');
  } catch (err) {
    console.error('❌ Reconciliation aborted due to unhandled error:', err);
  } finally {
    pgClient.release();
    await pool.end();
  }
}

main();
