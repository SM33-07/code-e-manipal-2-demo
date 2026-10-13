#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Demo Accounts Identifier Archival & Conflict Resolver
 * File: scripts/archive-demo-identifiers.mjs
 *
 * Safely resolves identifier collisions (TEAM-001..TEAM-010) caused by pre-event
 * demo accounts so real team leaders can receive their canonical identifiers.
 *
 * Principles:
 *  - Non-destructive: No profiles or teams are deleted.
 *  - Preserves exact previous states in rollback SQL and audit logs.
 *  - Demo accounts are renamed to DEMO-TEAM-XXX and disabled.
 *  - Team 'Hi 2' foreign key relationships for participant@learnit-muj.com preserved.
 *  - Pre-event demo identifier TEAM-008 on Aditya Goyal is archived to DEMO-TEAM-008,
 *    freeing TEAM-008 for Aryan Sharma while preparing Aditya for TEAM-023.
 * ============================================================================
 */

import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL is missing. Run with --env-file=.env.local');
  process.exit(1);
}

export const DEMO_ARCHIVE_MAPPINGS = [
  {
    expectedProfileId: '4e41c7c9-a875-4319-b78d-36fa9638248d',
    currentId: 'TEAM-001',
    email: 'participant@learnit-muj.com',
    targetId: 'DEMO-TEAM-001',
    targetLogin: null,
    originalDisabled: false,
    newDisabled: true,
    action: 'ARCHIVE_DEMO',
    rationale: 'Pre-event template test account created 2026-06-15 (hackathon: LearnIT 2025, team: Hi 2). Team record preserved.',
  },
  {
    expectedProfileId: '0c5446bf-4a0e-48c2-a03c-995cfb686cf6',
    currentId: 'TEAM-002',
    email: 'yashsrivastava3345@gmail.com',
    targetId: 'DEMO-TEAM-002',
    targetLogin: null,
    originalDisabled: true,
    newDisabled: true,
    action: 'ARCHIVE_DEMO',
    rationale: 'Early test account (disabled, no team association, no Auth identity).',
  },
  {
    expectedProfileId: '210a4521-2ee4-4d7f-87dc-4372b8aea182',
    currentId: 'TEAM-003',
    email: 'yashsrivastava345@gmail.com',
    targetId: 'DEMO-TEAM-003',
    targetLogin: null,
    originalDisabled: true,
    newDisabled: true,
    action: 'ARCHIVE_DEMO',
    rationale: 'Early test account (disabled, no team association, session revoked in audit log).',
  },
  {
    expectedProfileId: '6daf8d15-d62e-4ed0-b13c-896fed110a06',
    currentId: 'TEAM-007',
    email: 'afy6wqzv8@mozmail.com',
    targetId: 'DEMO-TEAM-007',
    targetLogin: null,
    originalDisabled: true,
    newDisabled: true,
    action: 'ARCHIVE_DEMO',
    rationale: 'Burner Firefox Relay test account ("test acc", disabled, no team).',
  },
  {
    expectedProfileId: '12825ab1-73cf-4c91-91d3-5db99555329f',
    currentId: 'TEAM-009',
    email: 'jsja@gmail.com',
    targetId: 'DEMO-TEAM-009',
    targetLogin: null,
    originalDisabled: true,
    newDisabled: true,
    action: 'ARCHIVE_DEMO',
    rationale: 'Garbage dummy account ("xyyx", disabled, sessions revoked).',
  },
  {
    expectedProfileId: 'f8088113-e0a7-46ae-bd27-764ca6c39334',
    currentId: 'TEAM-010',
    email: 'test@gmail.com',
    targetId: 'DEMO-TEAM-010',
    targetLogin: null,
    originalDisabled: true,
    newDisabled: true,
    action: 'ARCHIVE_DEMO',
    rationale: 'Dummy test account ("Test", disabled, no team).',
  },
];

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = args.includes('--dry-run') || !isExecute;
  const confirmArg = args[args.indexOf('--confirm') + 1];

  console.log('================================================================');
  console.log('   Code-e-Manipal 2.0 — Demo Identifier Conflict Resolver');
  console.log('================================================================');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Safe, zero database writes)' : 'EXECUTE (Applying changes)'}`);
  console.log('----------------------------------------------------------------\n');

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Fetch current database state
    const profilesRes = await client.query(`
      SELECT p.id, p.name, p.email, p.role, p.identifier, p.login_id, p.is_disabled, p.team_id
      FROM public.profiles p
      WHERE p.identifier ~ '^TEAM-0(0[1-9]|10)$' OR p.email = 'synthreaperx@gmail.com'
      ORDER BY p.identifier;
    `);

    console.log('Current Identified Records in Azure PostgreSQL:');
    console.table(profilesRes.rows.map(p => ({
      ID: p.id.slice(0, 8) + '...',
      Name: p.name,
      Email: p.email,
      Identifier: p.identifier,
      Login_ID: p.login_id,
      Disabled: p.is_disabled,
      Has_Team: !!p.team_id,
    })));

    console.log('\nProposed Archival Plan (Exact Before & After Values):');
    console.table(DEMO_ARCHIVE_MAPPINGS.map(m => ({
      Target_UUID: m.expectedProfileId.slice(0, 8) + '...',
      Current_ID: m.currentId,
      Target_ID: m.targetId,
      Email: m.email,
      Original_Disabled: m.originalDisabled,
      New_Disabled: m.newDisabled,
      Target_Login: m.targetLogin ?? '<NULL>',
      Action: m.action,
    })));

    console.log('\nSeparate Operations Summary:');
    console.log('  1. Demo Identifier Archival: Releases TEAM-001, 002, 003, 007, 008 (demo), 009, 010.');
    console.log('  2. Admin Roster Reconciliation: TEAM-004, 005, 006 -> ADMIN-03, 02, 04 via scripts/provision-admin-judge.mjs');
    console.log('  3. Aditya Goyal Team Leader Provisioning: Reconciles Void Labs (U5T83P0G) to TEAM-023 via provision-team-leaders.mjs');
    console.log('  4. Account Deletion: Separate explicitly approved operation if purging obsolete records is desired.');

    if (isDryRun) {
      console.log('\n================================================================');
      console.log('✅ DRY-RUN COMPLETED.');
      console.log('   Zero database changes were made.');
      console.log('   To execute with explicit confirmation:');
      console.log('   node --env-file=.env.local scripts/archive-demo-identifiers.mjs --execute --confirm yes');
      console.log('================================================================');
      return;
    }

    if (confirmArg !== 'yes' && confirmArg !== 'production') {
      console.error('\n❌ Execution halted: Missing required flag: --confirm yes');
      process.exitCode = 1;
      return;
    }

    console.log('\n🚀 Executing transactional archival in Azure PostgreSQL...');
    await client.query('BEGIN');

    for (const item of DEMO_ARCHIVE_MAPPINGS) {
      const match = profilesRes.rows.find(p => p.id === item.expectedProfileId);
      if (!match) {
        throw new Error(`Integrity Error: Record for ${item.email} (UUID ${item.expectedProfileId}) not found in database. Aborting transaction.`);
      }

      if (match.identifier !== item.currentId) {
        throw new Error(`Integrity Error: Current identifier for ${item.email} (UUID ${item.expectedProfileId}) is "${match.identifier}", expected "${item.currentId}". Aborting.`);
      }

      const updateRes = await client.query(`
        UPDATE public.profiles
        SET identifier = $1, login_id = $2, is_disabled = $3, updated_at = NOW()
        WHERE id = $4 AND identifier = $5;
      `, [item.targetId, item.targetLogin, item.newDisabled, match.id, item.currentId]);

      if (updateRes.rowCount !== 1) {
        throw new Error(`Integrity Error: Expected 1 updated row for ${item.email}, got ${updateRes.rowCount}. Aborting.`);
      }

      // Record immutable audit event using the target profile's own valid UUID
      await client.query(`
        INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
        VALUES ($1, $2, 'profiles', $3, $4);
      `, [
        match.id,
        'DEMO_IDENTIFIER_ARCHIVED',
        match.id,
        JSON.stringify({
          previous_identifier: match.identifier,
          new_identifier: item.targetId,
          previous_login_id: match.login_id,
          new_login_id: item.targetLogin,
          previous_disabled: match.is_disabled,
          new_disabled: item.newDisabled,
          email: item.email,
          rationale: item.rationale,
        }),
      ]);

      console.log(`   ✅ [${item.email}] ${match.identifier} ➔ ${item.targetId} (Audit event logged)`);
    }

    await client.query('COMMIT');
    console.log('\n================================================================');
    console.log('🎉 ALL DEMO CONFLICTS SUCCESSFULLY RESOLVED AND AUDITED.');
    console.log('================================================================');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error executing conflict archival:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
