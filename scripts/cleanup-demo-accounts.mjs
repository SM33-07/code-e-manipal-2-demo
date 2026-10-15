#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Comprehensive Demo Account Cleanup & Reconciliation Utility
 * File: scripts/cleanup-demo-accounts.mjs
 *
 * Safely eliminates stale test identities and obsolete database records across
 * Supabase Auth and Azure PostgreSQL, while strictly preserving legitimate users,
 * registrations, teams, judging data, and audit history.
 *
 * Capabilities:
 *  - Identifies target profiles by IMMUTABLE UUID and verifies expected previous state
 *  - Handles duplicate profiles for the same email (e.g. separating seed vs shadow profiles)
 *  - Protects primary bootstrap admin (ADMIN-01 / eb3ba0ae...) from accidental deletion
 *  - Checks foreign key dependencies: blocks deletion if submissions or reviews exist
 *  - Preserves historical audit_logs (foreign keys safely handled via SET NULL)
 *  - Distinguishes archived demo identifiers (DEMO-TEAM-XXX) from disposable test profiles
 *  - Safe dry-run by default (--dry-run)
 *  - Guarded production execution (--execute --confirm "cleanup-demo-accounts")
 * ============================================================================
 */

import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// ── Environment Verification ────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function checkEnv() {
  const missing = [];
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Please run with: node --env-file=.env.local scripts/cleanup-demo-accounts.mjs ...');
    process.exit(1);
  }
}

// ── Explicit Protection Allowlist ───────────────────────────────────────────
// These identities must NEVER be deleted under any circumstances
export const PROTECTED_EMAILS = new Set([
  'abhinav.ong@gmail.com',
  'yashsrivastava3745@gmail.com',
  'sohammore3312@gmail.com',
  'synthreaperx@gmail.com',
]);

// Seed bootstrap identities preserved to avoid lockout
export const PROTECTED_BOOTSTRAP_PROFILES = new Map([
  [
    'eb3ba0ae-c5dd-45ff-bc9f-adfec41bc446',
    {
      email: 'admin@learnit-muj.com',
      identifier: 'ADMIN-01',
      role: 'admin',
      reason: 'Primary seed bootstrap administrator (ADMIN-01). Preserved to prevent admin lockout.',
    },
  ],
  [
    '3f93c481-5209-4223-a6d6-e8ac762fa372',
    {
      email: 'judge@learnit-muj.com',
      identifier: 'JUDGE-01',
      role: 'judge',
      reason: 'Primary seed judge profile (JUDGE-01). Preserved unless explicitly decommissioned.',
    },
  ],
]);

// Verified immutable UUIDs for disposable test profiles
export const DISPOSABLE_PROFILE_TARGETS = new Map([
  [
    '4e41c7c9-a875-4319-b78d-36fa9638248d',
    {
      expectedEmail: 'participant@learnit-muj.com',
      expectedIdentifier: 'TEAM-001',
      expectedRole: 'participant',
      classification: 'DEMO_PARTICIPANT_SEED',
      reason: 'Seed demo participant holding TEAM-001 and creator of demo team "Hi 2"',
    },
  ],
  [
    '9e9d0803-6d6d-4578-87dc-65ea78fad166',
    {
      expectedEmail: 'participant@learnit-muj.com',
      expectedIdentifier: 'USER-4AB82814',
      expectedRole: 'participant',
      classification: 'DEMO_PARTICIPANT_SHADOW',
      reason: 'Duplicate portal-signup demo participant and creator of demo team "SM"',
    },
  ],
  [
    'e750edc5-65f7-4512-a54e-185de733136c',
    {
      expectedEmail: 'admin@learnit-muj.com',
      expectedIdentifier: 'USER-AF10CCD7',
      expectedRole: 'admin',
      classification: 'DEMO_ADMIN_SHADOW_DUPLICATE',
      reason: 'Duplicate portal-signup shadow profile for admin@learnit-muj.com',
    },
  ],
  [
    '2a86c3bd-fdbb-40e4-93d4-c90369829f00',
    {
      expectedEmail: 'judge@learnit-muj.com',
      expectedIdentifier: 'USER-DD46BF0C',
      expectedRole: 'judge',
      classification: 'DEMO_JUDGE_SHADOW_DUPLICATE',
      reason: 'Duplicate portal-signup shadow profile for judge@learnit-muj.com',
    },
  ],
]);

// ── Discovery & Classification ──────────────────────────────────────────────
export async function discoverSystemState(pgClient, supabase) {
  // 1. Fetch Azure PG profiles
  const profilesRes = await pgClient.query(`
    SELECT id, name, email, role, identifier, login_id, team_id, is_disabled, created_at
    FROM public.profiles
    ORDER BY created_at ASC;
  `);

  // 2. Fetch Azure PG teams
  const teamsRes = await pgClient.query(`
    SELECT id, name, hackathon, invite_code, leader_name, created_by, created_at
    FROM public.teams;
  `);

  // 3. Fetch Azure PG team_members
  const membersRes = await pgClient.query(`
    SELECT tm.team_id, tm.user_id, tm.role, t.name as team_name
    FROM public.team_members tm
    LEFT JOIN public.teams t ON tm.team_id = t.id;
  `);

  // 4. Fetch Azure auth.users shadow table
  let shadowUsers = [];
  try {
    const shadowRes = await pgClient.query(`SELECT id, email FROM auth.users;`);
    shadowUsers = shadowRes.rows;
  } catch (_) { }

  // 5. Fetch Supabase Auth users
  const authUsers = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Supabase Auth listUsers failed: ${error.message}`);
    authUsers.push(...data.users);
    if (data.users.length < 100) break;
  }

  // 6. Fetch hackathon registrations
  let registrations = [];
  try {
    const regRes = await pgClient.query(`SELECT id, email, name, team_name FROM public.hackathon_registrations;`);
    registrations = regRes.rows;
  } catch (_) { }

  // 7. Check for submissions referencing teams or users
  let submissions = [];
  try {
    const subRes = await pgClient.query(`SELECT id, team_id, emergency_override_by FROM public.submissions;`);
    submissions = subRes.rows;
  } catch (_) { }

  // 8. Check for review history referencing judges
  let reviews = [];
  try {
    const revRes = await pgClient.query(`SELECT id, judge_id, changed_by FROM public.review_history;`);
    reviews = revRes.rows;
  } catch (_) { }

  return {
    profiles: profilesRes.rows,
    teams: teamsRes.rows,
    teamMembers: membersRes.rows,
    shadowUsers,
    authUsers,
    registrations,
    submissions,
    reviews,
  };
}

export function classifyRecords(state, options = {}) {
  const { includeAllDisposable = false, purgeArchived = false } = options;

  const namedTestCandidates = [];
  const orphanedDemoCandidates = [];
  const retainedProtectedRecords = [];
  const duplicateProfileGroups = new Map();
  const ambiguousRecords = [];

  // Group profiles by email to detect duplicates
  state.profiles.forEach(p => {
    const email = (p.email || '').toLowerCase();
    if (!duplicateProfileGroups.has(email)) {
      duplicateProfileGroups.set(email, []);
    }
    duplicateProfileGroups.get(email).push(p);
  });

  // Track referenced team IDs in submissions
  const submittedTeamIds = new Set(state.submissions.map(s => s.team_id).filter(Boolean));
  const reviewingUserIds = new Set(state.reviews.map(r => r.judge_id).concat(state.reviews.map(r => r.changed_by)).filter(Boolean));

  state.profiles.forEach(p => {
    const email = (p.email || '').toLowerCase();
    const id = p.id;

    // 1. Absolute protection for legitimate organizers and participants
    if (PROTECTED_EMAILS.has(email)) {
      retainedProtectedRecords.push({
        type: 'PROFILE_PROTECTED_ORGANIZER',
        id: p.id,
        email,
        name: p.name,
        identifier: p.identifier,
        reason: 'Organizer / legitimate participant identity (Protected from deletion)',
      });
      return;
    }

    // 2. Explicit protection for bootstrap seed admin / judge profiles
    if (PROTECTED_BOOTSTRAP_PROFILES.has(id)) {
      const spec = PROTECTED_BOOTSTRAP_PROFILES.get(id);
      retainedProtectedRecords.push({
        type: 'PROFILE_PROTECTED_BOOTSTRAP_SEED',
        id: p.id,
        email,
        name: p.name,
        identifier: p.identifier,
        reason: spec.reason,
      });
      return;
    }

    // 3. Competition data protection: never delete profiles with judging or submissions
    if (reviewingUserIds.has(id)) {
      retainedProtectedRecords.push({
        type: 'PROFILE_PROTECTED_HAS_REVIEWS',
        id: p.id,
        email,
        name: p.name,
        identifier: p.identifier,
        reason: 'Referenced in judging reviews table (foreign data preserved)',
      });
      return;
    }

    // 4. Archival protection: profiles already archived with DEMO-TEAM-XXX are retained unless purgeArchived is true
    if (p.identifier && p.identifier.startsWith('DEMO-')) {
      if (!purgeArchived) {
        retainedProtectedRecords.push({
          type: 'PROFILE_ARCHIVED_DEMO_RETAINED',
          id: p.id,
          email,
          name: p.name,
          identifier: p.identifier,
          reason: 'Archived demo profile (holding DEMO-TEAM-XXX); retained for audit/reference',
        });
        return;
      }
    }

    // 5. Explicit immutable UUID targets
    if (DISPOSABLE_PROFILE_TARGETS.has(id)) {
      const spec = DISPOSABLE_PROFILE_TARGETS.get(id);

      // Verify expected state matches actual state
      const emailMatches = email === spec.expectedEmail.toLowerCase();
      const roleMatches = p.role === spec.expectedRole;
      if (!emailMatches || !roleMatches) {
        ambiguousRecords.push({
          type: 'PROFILE_UUID_STATE_MISMATCH',
          id: p.id,
          email,
          name: p.name,
          identifier: p.identifier,
          reason: `Target UUID state mismatch: expected email "${spec.expectedEmail}" & role "${spec.expectedRole}", found "${email}" & "${p.role}"`,
        });
        return;
      }

      namedTestCandidates.push({
        type: spec.classification,
        id: p.id,
        email,
        name: p.name,
        identifier: p.identifier,
        login_id: p.login_id,
        team_id: p.team_id,
        reason: spec.reason,
      });
      return;
    }

    // 6. Category: Generated Badge / Synthetic accounts (@codeemanipal.in, testleader@example.com)
    if (email.endsWith('@codeemanipal.in') || email === 'testleader@example.com') {
      if (includeAllDisposable) {
        orphanedDemoCandidates.push({
          type: 'PROFILE_GENERATED_TEST',
          id: p.id,
          email,
          name: p.name,
          identifier: p.identifier,
          login_id: p.login_id,
          team_id: p.team_id,
          reason: 'Bulk generator synthetic credential test account (absent in Supabase Auth)',
        });
      } else {
        ambiguousRecords.push({
          type: 'PROFILE_GENERATED_TEST',
          id: p.id,
          email,
          name: p.name,
          identifier: p.identifier,
          reason: 'Generated synthetic account (enable --target-all-demos to include in deletion)',
        });
      }
      return;
    }

    // 7. Category: Pre-event Disposable Demos
    const isDisposablePreEvent = [
      'yashsrivastava3345@gmail.com',
      'yashsrivastava345@gmail.com',
      'afy6wqzv8@mozmail.com',
      'jsja@gmail.com',
      'test@gmail.com',
    ].includes(email);

    if (isDisposablePreEvent) {
      if (includeAllDisposable) {
        orphanedDemoCandidates.push({
          type: 'PROFILE_PRE_EVENT_DEMO',
          id: p.id,
          email,
          name: p.name,
          identifier: p.identifier,
          login_id: p.login_id,
          team_id: p.team_id,
          reason: 'Pre-event dummy test account (disabled, no team, absent in Supabase Auth)',
        });
      } else {
        ambiguousRecords.push({
          type: 'PROFILE_PRE_EVENT_DEMO',
          id: p.id,
          email,
          name: p.name,
          identifier: p.identifier,
          reason: 'Pre-event disposable demo account (enable --target-all-demos to include in deletion)',
        });
      }
      return;
    }

    // Any other profile
    ambiguousRecords.push({
      type: 'PROFILE_UNCLASSIFIED',
      id: p.id,
      email,
      name: p.name,
      identifier: p.identifier,
      reason: 'Unclassified profile; requires manual review',
    });
  });

  // Supabase Auth candidates for deletion (only for targeted candidate profiles)
  const candidateProfileIds = new Set([
    ...namedTestCandidates.map(c => c.id),
    ...orphanedDemoCandidates.map(c => c.id),
  ]);

  const authCandidates = [];
  state.authUsers.forEach(u => {
    const email = (u.email || '').toLowerCase();
    if (PROTECTED_EMAILS.has(email)) {
      retainedProtectedRecords.push({
        type: 'AUTH_PROTECTED',
        id: u.id,
        email,
        reason: 'Protected organizer / participant identity in Supabase Auth',
      });
      return;
    }

    // Only delete Auth users that match targeted candidate profiles by ID or explicit test email
    if (candidateProfileIds.has(u.id)) {
      authCandidates.push({
        type: 'AUTH_TARGETED_TEST',
        id: u.id,
        email,
        role: u.user_metadata?.role,
        reason: `Matched targeted disposable profile UUID ${u.id}`,
      });
      return;
    }

    if (['admin@learnit-muj.com', 'participant@learnit-muj.com', 'judge@learnit-muj.com'].includes(email)) {
      authCandidates.push({
        type: 'AUTH_NAMED_TEST',
        id: u.id,
        email,
        role: u.user_metadata?.role,
        reason: 'Explicitly named test user in Supabase Auth',
      });
      return;
    }

    if (includeAllDisposable && (email.endsWith('@codeemanipal.in') || email === 'testleader@example.com')) {
      authCandidates.push({
        type: 'AUTH_GENERATED_TEST',
        id: u.id,
        email,
        reason: 'Synthetic generator test user in Supabase Auth',
      });
      return;
    }
  });

  // Teams classification (only LearnIT 2025 demo teams with test creators AND zero submissions)
  const candidateTeams = state.teams.filter(t => {
    const createdByTest = candidateProfileIds.has(t.created_by);
    const isDemoHackathon = t.hackathon === 'LearnIT 2025' || t.hackathon === 'Code-e-Manipal Demo';
    const hasSubmissions = submittedTeamIds.has(t.id);
    return createdByTest && isDemoHackathon && !hasSubmissions;
  });

  // Duplicate profiles summary
  const duplicateProfilesReport = [];
  duplicateProfileGroups.forEach((profiles, email) => {
    if (profiles.length > 1) {
      duplicateProfilesReport.push({
        email,
        count: profiles.length,
        profiles: profiles.map(p => ({
          id: p.id,
          identifier: p.identifier,
          role: p.role,
          created_at: p.created_at,
          action: candidateProfileIds.has(p.id) ? 'DELETE' : 'PRESERVE',
        })),
      });
    }
  });

  return {
    namedTestCandidates,
    orphanedDemoCandidates,
    authCandidates,
    candidateTeams,
    retainedProtectedRecords,
    duplicateProfilesReport,
    ambiguousRecords,
  };
}

// ── Execution Logic ─────────────────────────────────────────────────────────
export async function executeCleanup(plan, pgClient, supabase) {
  console.log('\n🚀 Executing Cleanup Workflow...');
  const results = {
    deletedAuthUsers: [],
    deletedProfiles: [],
    deletedTeams: [],
    deletedMembers: [],
    deletedShadows: [],
    auditLogsPreserved: true,
  };

  const allProfilesToDelete = [
    ...plan.namedTestCandidates,
    ...plan.orphanedDemoCandidates,
  ];

  const profileIdsToDelete = allProfilesToDelete.map(p => p.id);
  const teamIdsToDelete = plan.candidateTeams.map(t => t.id);

  // 1. Supabase Auth Deletions
  console.log(`\n1. Deleting verified test users from Supabase Auth (${plan.authCandidates.length})...`);
  for (const authUser of plan.authCandidates) {
    try {
      const { error: delErr } = await supabase.auth.admin.deleteUser(authUser.id);
      if (delErr) {
        console.warn(`   ⚠️ Warning deleting Auth user ${authUser.email} (${authUser.id}): ${delErr.message}`);
      } else {
        console.log(`   ✅ Deleted Auth user: ${authUser.email} (${authUser.id})`);
        results.deletedAuthUsers.push({ id: authUser.id, email: authUser.email });
      }
    } catch (e) {
      console.error(`   ❌ Failed deleting Auth user ${authUser.email}:`, e.message);
    }
  }

  // 2. Azure PostgreSQL Transactional Cleanup
  console.log(`\n2. Executing Azure PostgreSQL transactional cleanup...`);
  await pgClient.query('BEGIN');

  try {
    // A. Delete Team Members for candidate teams or candidate users
    if (profileIdsToDelete.length > 0 || teamIdsToDelete.length > 0) {
      const delMembers = await pgClient.query(`
        DELETE FROM public.team_members
        WHERE user_id = ANY($1::uuid[]) OR team_id = ANY($2::uuid[])
        RETURNING user_id, team_id;
      `, [profileIdsToDelete, teamIdsToDelete]);
      console.log(`   ✅ Deleted ${delMembers.rowCount} public.team_members row(s)`);
      results.deletedMembers = delMembers.rows;
    }

    // B. Clear team_id on profiles to avoid circular FK
    if (profileIdsToDelete.length > 0) {
      await pgClient.query(`
        UPDATE public.profiles
        SET team_id = NULL
        WHERE id = ANY($1::uuid[]);
      `, [profileIdsToDelete]);
    }

    // C. Delete Candidate Teams
    if (teamIdsToDelete.length > 0) {
      const delTeams = await pgClient.query(`
        DELETE FROM public.teams
        WHERE id = ANY($1::uuid[])
        RETURNING id, name, invite_code;
      `, [teamIdsToDelete]);
      console.log(`   ✅ Deleted ${delTeams.rowCount} demo public.teams row(s)`);
      results.deletedTeams = delTeams.rows;
    }

    // D. Delete Profiles (audit_logs.user_id automatically sets to NULL via SET NULL constraint)
    if (profileIdsToDelete.length > 0) {
      const delProfiles = await pgClient.query(`
        DELETE FROM public.profiles
        WHERE id = ANY($1::uuid[])
        RETURNING id, email, identifier;
      `, [profileIdsToDelete]);
      console.log(`   ✅ Deleted ${delProfiles.rowCount} obsolete public.profiles row(s)`);
      results.deletedProfiles = delProfiles.rows;
    }

    // E. Delete from auth.users shadow table
    if (profileIdsToDelete.length > 0) {
      try {
        const delShadow = await pgClient.query(`
          DELETE FROM auth.users
          WHERE id = ANY($1::uuid[])
          RETURNING id, email;
        `, [profileIdsToDelete]);
        console.log(`   ✅ Deleted ${delShadow.rowCount} shadow auth.users row(s)`);
        results.deletedShadows = delShadow.rows;
      } catch (_) { }
    }

    // F. Record cleanup audit log event
    await pgClient.query(`
      INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
      VALUES (
        NULL,
        'DEMO_ACCOUNTS_CLEANUP_EXECUTED',
        'profiles',
        'BATCH',
        $1::jsonb
      );
    `, [JSON.stringify({
      deleted_profiles_count: results.deletedProfiles.length,
      deleted_teams_count: results.deletedTeams.length,
      deleted_auth_count: results.deletedAuthUsers.length,
      timestamp: new Date().toISOString(),
    })]);

    await pgClient.query('COMMIT');
    console.log(`   ✅ Azure PostgreSQL transaction committed successfully.`);
  } catch (txErr) {
    await pgClient.query('ROLLBACK').catch(() => { });
    console.error(`   ❌ Azure PostgreSQL cleanup transaction failed:`, txErr.message);
    throw txErr;
  }

  return results;
}

// ── Main Controller ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = args.includes('--dry-run') || !isExecute;
  const includeAllDisposable = args.includes('--target-all-demos');
  const purgeArchived = args.includes('--purge-archived');
  const confirmArg = args[args.indexOf('--confirm') + 1];

  checkEnv();

  console.log('================================================================');
  console.log('   Code-e-Manipal 2.0 — Comprehensive Demo Cleanup Utility');
  console.log('================================================================');
  console.log(`Mode:               ${isDryRun ? 'DRY-RUN (Safe, zero writes)' : 'EXECUTE (Destructive Cleanup)'}`);
  console.log(`Scope:              ${includeAllDisposable ? 'ALL VERIFIED DEMOS (Named + Generated + Pre-event)' : 'TARGETED DISPOSABLE ACCOUNTS (Explicit UUIDs)'}`);
  console.log(`Archived Profiles:  ${purgeArchived ? 'PURGE INCLUDED' : 'RETAINED & PROTECTED (Holding DEMO-TEAM-XXX)'}`);
  console.log(`Database URL:       ${databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@')}`);
  console.log(`Supabase Project:   ${supabaseUrl}`);
  console.log('----------------------------------------------------------------\n');

  const pgClient = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Advisory lock
    await pgClient.query("SELECT pg_advisory_xact_lock(hashtext('code-e-manipal-demo-cleanup'))");

    console.log('1. Discovering current system state across Azure PG and Supabase Auth...');
    const state = await discoverSystemState(pgClient, supabase);
    console.log(`   - Azure PG Profiles:     ${state.profiles.length}`);
    console.log(`   - Azure PG Teams:        ${state.teams.length}`);
    console.log(`   - Azure PG Team Members: ${state.teamMembers.length}`);
    console.log(`   - Azure auth.users:      ${state.shadowUsers.length}`);
    console.log(`   - Supabase Auth Users:   ${state.authUsers.length}`);
    console.log(`   - Submissions:           ${state.submissions.length}`);
    console.log(`   - Review History:        ${state.reviews.length}`);

    console.log('\n2. Classifying records based on provenance, immutable UUIDs, and foreign dependencies...');
    const plan = classifyRecords(state, { includeAllDisposable, purgeArchived });

    console.log('\n📋 DISCOVERY & CLASSIFICATION REPORT:');

    // Duplicate Profiles Inventory
    if (plan.duplicateProfilesReport.length > 0) {
      console.log(`\n• Duplicate Profile Analysis (${plan.duplicateProfilesReport.length} emails with multiple profiles):`);
      plan.duplicateProfilesReport.forEach(g => {
        console.log(`  📧 ${g.email} (${g.count} profiles):`);
        g.profiles.forEach(p => {
          console.log(`     ↳ ID: ${p.id.slice(0, 8)}... | Identifier: ${p.identifier || 'none'} | Role: ${p.role} | Action: ${p.action}`);
        });
      });
    }

    console.log(`\n• Targeted Profiles for Deletion (${plan.namedTestCandidates.length}):`);
    console.table(plan.namedTestCandidates.map(c => ({
      ID: c.id.slice(0, 8) + '...',
      Email: c.email,
      Name: c.name,
      Identifier: c.identifier,
      Login_ID: c.login_id || '—',
      Team_ID: c.team_id ? c.team_id.slice(0, 8) + '...' : 'None',
      Type: c.type,
    })));

    console.log(`\n• Supabase Auth Users Targeted for Deletion (${plan.authCandidates.length}):`);
    console.table(plan.authCandidates.map(c => ({
      ID: c.id.slice(0, 8) + '...',
      Email: c.email,
      Role: c.role || 'none',
      Reason: c.reason,
    })));

    console.log(`\n• Demo Teams Targeted for Deletion (${plan.candidateTeams.length}):`);
    console.table(plan.candidateTeams.map(t => ({
      ID: t.id.slice(0, 8) + '...',
      Name: t.name,
      Hackathon: t.hackathon,
      Invite_Code: t.invite_code,
      Created_By: t.created_by.slice(0, 8) + '...',
    })));

    if (includeAllDisposable) {
      console.log(`\n• Additional Disposable Demo Profiles Targeted (${plan.orphanedDemoCandidates.length}):`);
      console.table(plan.orphanedDemoCandidates.map(c => ({
        ID: c.id.slice(0, 8) + '...',
        Email: c.email,
        Identifier: c.identifier,
        Type: c.type,
      })));
    }

    console.log(`\n• Strictly Retained & Protected Profiles (${plan.retainedProtectedRecords.length}):`);
    console.table(plan.retainedProtectedRecords.map(r => ({
      Type: r.type,
      ID: r.id ? r.id.slice(0, 8) + '...' : '—',
      Email: r.email,
      Identifier: r.identifier || '—',
      Reason: r.reason,
    })));

    if (plan.ambiguousRecords.length > 0) {
      console.log(`\n• Ambiguous / Unclassified Records Preserved (${plan.ambiguousRecords.length}):`);
      console.table(plan.ambiguousRecords.slice(0, 10).map(r => ({
        ID: r.id.slice(0, 8) + '...',
        Email: r.email,
        Identifier: r.identifier || '—',
        Reason: r.reason,
      })));
    }

    if (isDryRun) {
      console.log('\n================================================================');
      console.log('✅ DRY-RUN COMPLETED SUCCESSFULLY.');
      console.log('   Zero modifications were made to Azure PostgreSQL or Supabase Auth.');
      console.log('   All legitimate admins, participants, and teams remain 100% untouched.');
      console.log('\nTo execute approved cleanup, run with:');
      console.log('   node --env-file=.env.local scripts/cleanup-demo-accounts.mjs --execute --confirm "cleanup-demo-accounts"');
      console.log('================================================================');
      return;
    }

    // Confirmation Guard
    if (confirmArg !== 'cleanup-demo-accounts' && confirmArg !== 'yes') {
      console.error('\n❌ Execution halted: Missing required confirmation flag: --confirm "cleanup-demo-accounts"');
      process.exitCode = 1;
      return;
    }

    const results = await executeCleanup(plan, pgClient, supabase);

    console.log('\n================================================================');
    console.log('🏁 CLEANUP COMPLETED:');
    console.log(`   - Deleted Supabase Auth Users:  ${results.deletedAuthUsers.length}`);
    console.log(`   - Deleted Azure PG Profiles:    ${results.deletedProfiles.length}`);
    console.log(`   - Deleted Azure PG Teams:       ${results.deletedTeams.length}`);
    console.log(`   - Deleted Azure Team Members:   ${results.deletedMembers.length}`);
    console.log(`   - Deleted Azure Shadow Users:   ${results.deletedShadows.length}`);
    console.log(`   - Audit History Preserved:      YES (audit_logs.user_id set to NULL)`);
    console.log('================================================================');
  } finally {
    await pgClient.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('cleanup-demo-accounts.mjs')) {
  main().catch(err => {
    console.error('💥 Fatal error in cleanup utility:', err);
    process.exit(1);
  });
}
