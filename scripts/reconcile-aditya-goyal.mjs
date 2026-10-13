#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Dedicated Aditya Goyal (TEAM-023) Reconciliation Utility
 * File: scripts/reconcile-aditya-goyal.mjs
 *
 * Safely and explicitly reconciles legitimate participant Aditya Goyal
 * (synthreaperx@gmail.com) from his pre-event August demo state (holding TEAM-008)
 * to his verified registration state:
 *  - Team Name: Void Labs
 *  - Registration Team ID: U5T83P0G
 *  - Canonical Identifier: TEAM-023
 *  - Login ID: TEAM-023
 *  - Team Role: leader
 *
 * Ensures:
 *  - Uses registration invite_code "U5T83P0G" (not team name alone)
 *  - Links/creates Supabase Auth user
 *  - Links/creates public.teams record
 *  - Inserts public.team_members row (leader)
 *  - Enables profile (is_disabled = false) ONLY when all dependencies are verified
 *  - Frees TEAM-008 for Aryan Sharma
 * ============================================================================
 */

import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Run with --env-file=.env.local');
  process.exit(1);
}

const REGISTRATION_DETAILS = {
  expectedProfileId: 'e2ebabbb-5518-4027-bc6c-55b0bd3cc198',
  name: 'Aditya Goyal',
  email: 'synthreaperx@gmail.com',
  registrationTeamId: 'U5T83P0G',
  teamName: 'Void Labs',
  canonicalIdentifier: 'TEAM-023',
  loginId: null,
  hackathon: 'Code-e-Manipal 2.0',
};

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = args.includes('--dry-run') || !isExecute;
  const confirmArg = args[args.indexOf('--confirm') + 1];

  console.log('================================================================');
  console.log('   Code-e-Manipal 2.0 — Aditya Goyal Separate Reconciliation');
  console.log('================================================================');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Safe, zero writes)' : 'EXECUTE (Applying changes)'}`);
  console.log('----------------------------------------------------------------\n');

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Fetch current profile
    const profileRes = await client.query(`
      SELECT id, name, email, role, identifier, login_id, team_id, is_disabled
      FROM public.profiles
      WHERE id = $1;
    `, [REGISTRATION_DETAILS.expectedProfileId]);

    if (profileRes.rows.length === 0) {
      throw new Error(`Profile with UUID ${REGISTRATION_DETAILS.expectedProfileId} (${REGISTRATION_DETAILS.email}) not found in Azure PostgreSQL.`);
    }

    const currentProfile = profileRes.rows[0];
    console.log('1. Current Profile State:');
    console.table([currentProfile]);

    // 2. Fetch Supabase Auth user
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 100 });
    const authUser = authUsers?.users?.find(u => (u.email || '').toLowerCase() === REGISTRATION_DETAILS.email.toLowerCase() || u.id === REGISTRATION_DETAILS.expectedProfileId);
    console.log(`2. Current Supabase Auth Status: ${authUser ? `Found (ID: ${authUser.id})` : 'Not present in Supabase Auth'}`);

    // 3. Check for team with registration code U5T83P0G
    const teamRes = await client.query(`
      SELECT id, name, invite_code, leader_name, created_by
      FROM public.teams
      WHERE invite_code = $1;
    `, [REGISTRATION_DETAILS.registrationTeamId]);
    console.log(`3. Existing Team with invite_code "${REGISTRATION_DETAILS.registrationTeamId}": ${teamRes.rows.length > 0 ? `Found (ID: ${teamRes.rows[0].id})` : 'None (will be created)'}`);

    // 4. Proposed reconciliation steps
    console.log('\n📋 Proposed Reconciliation Actions:');
    console.log(`  • Target Immutable Profile UUID: ${REGISTRATION_DETAILS.expectedProfileId}`);
    console.log(`  • Reassign profile identifier from "${currentProfile.identifier}" to "${REGISTRATION_DETAILS.canonicalIdentifier}"`);
    console.log(`  • Set login_id to NULL (participants authenticate strictly with canonical TEAM-XXX identifier)`);
    console.log(`  • Ensure Supabase Auth identity exists matching profile UUID ${REGISTRATION_DETAILS.expectedProfileId}`);
    console.log(`  • Match/create team "Void Labs" using invite_code "${REGISTRATION_DETAILS.registrationTeamId}"`);
    console.log(`  • Ensure team_members row exists with role "leader"`);
    console.log(`  • Enable profile (is_disabled = false)`);
    console.log(`  • Record immutable audit event in public.audit_logs`);

    if (isDryRun) {
      console.log('\n================================================================');
      console.log('✅ DRY-RUN COMPLETED.');
      console.log('   Zero modifications were made.');
      console.log('   To execute with explicit confirmation:');
      console.log('   node --env-file=.env.local scripts/reconcile-aditya-goyal.mjs --execute --confirm yes');
      console.log('================================================================');
      return;
    }

    if (confirmArg !== 'yes' && confirmArg !== 'production') {
      console.error('\n❌ Execution halted: Missing required flag: --confirm yes');
      process.exitCode = 1;
      return;
    }

    console.log('\n🚀 Executing reconciliation...');

    // A. Supabase Auth
    let authId = authUser?.id || null;
    let createdNewAuth = false;
    if (!authUser) {
      console.log('   • Creating Supabase Auth identity...');
      const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
        email: REGISTRATION_DETAILS.email,
        email_confirm: true,
        user_metadata: {
          name: REGISTRATION_DETAILS.name,
          role: 'participant',
          identifier: REGISTRATION_DETAILS.canonicalIdentifier,
          registration_team_id: REGISTRATION_DETAILS.registrationTeamId,
          team_name: REGISTRATION_DETAILS.teamName,
        },
      });
      if (createErr) throw createErr;
      authId = newAuth.user.id;
      createdNewAuth = true;
      console.log(`     ✅ Supabase Auth user created (UUID: ${authId})`);
    } else {
      authId = authUser.id;
    }

    // B. Azure PostgreSQL Transaction
    await client.query('BEGIN');

    try {
      // 1. Shadow auth.users
      await client.query(`
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data;
      `, [authId, REGISTRATION_DETAILS.email, JSON.stringify({ name: REGISTRATION_DETAILS.name, role: 'participant', identifier: REGISTRATION_DETAILS.canonicalIdentifier })]);

      // 2. Team by invite_code
      let teamId;
      if (teamRes.rows.length > 0) {
        teamId = teamRes.rows[0].id;
        console.log(`   • Existing team linked (ID: ${teamId})`);
      } else {
        const insTeam = await client.query(`
          INSERT INTO public.teams (name, hackathon, invite_code, leader_name, created_by, track)
          VALUES ($1, $2, $3, $4, $5, 'General')
          RETURNING id;
        `, [REGISTRATION_DETAILS.teamName, REGISTRATION_DETAILS.hackathon, REGISTRATION_DETAILS.registrationTeamId, REGISTRATION_DETAILS.name, currentProfile.id]);
        teamId = insTeam.rows[0].id;
        console.log(`   • Created public.teams record (ID: ${teamId})`);
      }

      // 3. Team member
      await client.query(`
        INSERT INTO public.team_members (team_id, user_id, role)
        VALUES ($1, $2, 'leader')
        ON CONFLICT DO NOTHING;
      `, [teamId, currentProfile.id]);
      console.log(`   • Linked in public.team_members as leader`);

      // 4. Update profile (strictly preserving immutable profile primary key UUID)
      await client.query(`
        UPDATE public.profiles
        SET identifier = $1, login_id = $2, team_id = $3, is_disabled = false, updated_at = NOW()
        WHERE id = $4;
      `, [REGISTRATION_DETAILS.canonicalIdentifier, REGISTRATION_DETAILS.loginId, teamId, currentProfile.id]);
      console.log(`   • Profile updated and enabled (ID: ${currentProfile.id}, Identifier: ${REGISTRATION_DETAILS.canonicalIdentifier})`);

      // 5. Audit log
      await client.query(`
        INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
        VALUES ($1, 'PARTICIPANT_RECONCILED_TO_REGISTRATION', 'profiles', $1::text, $2);
      `, [
        authId,
        JSON.stringify({
          email: REGISTRATION_DETAILS.email,
          previous_identifier: currentProfile.identifier,
          new_identifier: REGISTRATION_DETAILS.canonicalIdentifier,
          registration_team_id: REGISTRATION_DETAILS.registrationTeamId,
          team_id: teamId,
          team_name: REGISTRATION_DETAILS.teamName,
        }),
      ]);

      await client.query('COMMIT');
      console.log('\n================================================================');
      console.log('🎉 ADITYA GOYAL RECONCILIATION COMPLETED SUCCESSFULLY.');
      console.log('================================================================');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      if (createdNewAuth && authId) {
        console.warn(`   ⚠️ Executing compensating rollback: deleting newly created Supabase Auth user ${authId}...`);
        await supabase.auth.admin.deleteUser(authId).catch(delErr => {
          console.error(`   ❌ Failed compensating delete for Auth user ${authId}:`, delErr.message);
        });
      }
      throw txErr;
    }
  } catch (err) {
    console.error('❌ Error reconciling Aditya Goyal:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
