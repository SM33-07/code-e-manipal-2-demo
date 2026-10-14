import xlsx from 'xlsx';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'ggmwribwynonpsvsmpyz';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function attemptLogin(supabase, client, loginId, passcode) {
  const norm = loginId.trim().toUpperCase();
  const compact = norm.replace(/-/g, '');

  // 1. Authoritative identifier lookup in Azure PG
  const { rows } = await client.query(
    `SELECT p.id, p.name, p.email, p.role, p.identifier, p.login_id, p.team_id, p.is_disabled,
            t.name as team_name, t.invite_code as team_invite_code
     FROM public.profiles p
     LEFT JOIN public.teams t ON p.team_id = t.id
     WHERE UPPER(TRIM(p.identifier)) = $1
        OR UPPER(TRIM(p.identifier)) = $2
        OR UPPER(TRIM(COALESCE(p.login_id, ''))) = $1
        OR UPPER(TRIM(COALESCE(p.login_id, ''))) = $2
     LIMIT 2`,
    [norm, compact]
  );

  if (rows.length === 0) {
    return { success: false, reason: 'IDENTIFIER_NOT_FOUND' };
  }
  if (rows.length > 1) {
    return { success: false, reason: 'AMBIGUOUS_IDENTIFIER' };
  }

  const profile = rows[0];

  if (profile.is_disabled) {
    return { success: false, reason: 'ACCOUNT_DISABLED', profile };
  }

  // 2. Authenticate with Supabase Auth GoTrue
  const { data, error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: passcode,
  });

  if (error || !data.user) {
    return { success: false, reason: error?.message || 'AUTH_FAILED', profile };
  }

  return { success: true, profile, user: data.user, session: data.session };
}

async function attemptLoginWithRetry(supabase, client, loginId, passcode, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await attemptLogin(supabase, client, loginId, passcode);
    if (res.success) return res;
    if (res.reason && (res.reason.toLowerCase().includes('rate limit') || res.reason.includes('too many requests'))) {
      await sleep(2000 * attempt);
      continue;
    }
    return res;
  }
  return { success: false, reason: 'RATE_LIMIT_EXHAUSTED' };
}

async function main() {
  console.log('================================================================');
  console.log('  Code-e-Manipal 2.0 — End-to-End Workbook Credentials Verifier');
  console.log('================================================================\n');

  // Verify Environment
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const dbUrl = process.env.DATABASE_URL || '';

  const parsedSb = new URL(sbUrl);
  const parsedDb = new URL(dbUrl);

  if (!parsedSb.host.includes(STAGING_REF) || !parsedDb.pathname.includes('cem_staging')) {
    console.error(`❌ SAFETY ABORT: Target is NOT staging (${STAGING_REF} / cem_staging)!`);
    process.exit(1);
  }
  console.log(`✅ Staging verified: ${parsedSb.host} (${parsedDb.pathname})\n`);

  const workbookFile = 'code_e_manipal_team_credentials_alphanumeric.xlsx';
  const wb = xlsx.readFile(workbookFile);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Team Credentials']);

  console.log(`Loaded ${rows.length} credential pairs from workbook.`);

  const pg = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let successCount = 0;
  let failCount = 0;
  let teamMismatchCount = 0;
  let roleMismatchCount = 0;
  const failureLog = [];

  console.log('Testing authentication across all 86 participant accounts...\n');

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const loginId = String(r['Login ID'] || '').trim();
    const passcode = String(r['Temporary Passcode'] || '').trim();
    const expectedTeamName = String(r['Team Name'] || '').trim().toLowerCase();

    // Authenticate
    const res = await attemptLoginWithRetry(sb, pg, loginId, passcode);

    if (res.success) {
      successCount++;
      const p = res.profile;

      // Verify role is participant
      if (p.role !== 'participant') {
        roleMismatchCount++;
        failureLog.push({ loginId, error: `Invalid role: ${p.role} (expected participant)` });
      }

      // Verify team association
      if (!p.team_id) {
        teamMismatchCount++;
        failureLog.push({ loginId, error: `Missing team_id association` });
      }

      // Log progress periodically
      if ((i + 1) % 10 === 0 || i + 1 === rows.length) {
        console.log(`  [Progress: ${i + 1}/86] Authenticated ${successCount} accounts...`);
      }
    } else {
      failCount++;
      failureLog.push({ loginId, error: res.reason });
      console.error(`  ❌ Login failed for ${loginId}: ${res.reason}`);
    }

    // Rate limit safety delay
    await sleep(250);
  }

  console.log('\n--- Test 2: Negative Test (Invalid Passcode Rejection) ---');
  const negRes = await attemptLogin(sb, pg, 'TEAM001', 'WRONGPASS99');
  if (!negRes.success) {
    console.log(`✅ Negative test PASSED: Invalid passcode correctly rejected (${negRes.reason}).`);
  } else {
    console.error(`❌ Negative test FAILED: Invalid passcode was accepted!`);
  }

  console.log('\n--- Test 3: Duplicate Account Check ---');
  const { rows: duplicateCheck } = await pg.query(`
    SELECT login_id, COUNT(*) as count
    FROM public.profiles
    WHERE login_id LIKE 'TEAM%'
    GROUP BY login_id
    HAVING COUNT(*) > 1;
  `);
  if (duplicateCheck.length === 0) {
    console.log(`✅ Duplicate check PASSED: Zero duplicate profile rows for TEAM001-TEAM086.`);
  } else {
    console.error(`❌ Duplicate check FAILED: Found duplicate logins:`, duplicateCheck);
  }

  console.log('\n================================================================');
  console.log('🏁 FINAL AUTHENTICATION AUDIT REPORT:');
  console.log(`   Total Teams Tested:        ${rows.length}`);
  console.log(`   Successful Authentications: ${successCount} / ${rows.length} (${Math.round((successCount / rows.length) * 100)}%)`);
  console.log(`   Failed Authentications:     ${failCount}`);
  console.log(`   Role Mismatches:            ${roleMismatchCount}`);
  console.log(`   Team Association Errors:    ${teamMismatchCount}`);
  console.log('================================================================\n');

  if (failureLog.length > 0) {
    console.log('Detailed Failures:');
    console.table(failureLog);
  }

  await pg.end();

  if (failCount > 0 || roleMismatchCount > 0 || teamMismatchCount > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
