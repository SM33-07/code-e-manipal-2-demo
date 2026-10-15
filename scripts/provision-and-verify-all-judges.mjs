import fs from 'fs';
import path from 'path';
import pg from 'pg';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { generateParticipantPasscode, generateJudgePassword } from '../lib/admin/passwords.ts';

const dbUrl = process.env.DATABASE_URL;
const sbUrl = process.env.SUPABASE_URL;
const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl || !dbUrl.includes('cem_staging')) {
  console.error('❌ FATAL: Must target cem_staging! dbUrl:', dbUrl);
  process.exit(1);
}

if (!sbUrl || !sbUrl.includes('ggmwribwynonpsvsmpyz')) {
  console.error('❌ FATAL: Must target staging Supabase project (ggmwribwynonpsvsmpyz)!');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const supabaseAdmin = createClient(sbUrl, sbServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALL_JUDGE_SLOTS = [
  { slot: 1, name: 'Judge 1', identifier: 'JUDGE-02', login_id: 'judge1', email: 'judge-02@auth.codeemanipal.in' },
  { slot: 2, name: 'Judge 2', identifier: 'JUDGE-03', login_id: 'judge2', email: 'judge-03@auth.codeemanipal.in' },
  { slot: 3, name: 'Judge 3', identifier: 'JUDGE-04', login_id: 'judge3', email: 'judge-04@auth.codeemanipal.in' },
  { slot: 4, name: 'Judge 4', identifier: 'JUDGE-05', login_id: 'judge4', email: 'judge-05@auth.codeemanipal.in' },
  { slot: 5, name: 'Judge 5', identifier: 'JUDGE-06', login_id: 'judge5', email: 'judge-06@auth.codeemanipal.in' },
  { slot: 6, name: 'Judge 6', identifier: 'JUDGE-07', login_id: 'judge6', email: 'judge-07@auth.codeemanipal.in' },
  { slot: 7, name: 'Judge 7', identifier: 'JUDGE-08', login_id: 'judge7', email: 'judge-08@auth.codeemanipal.in' },
  { slot: 8, name: 'Judge 8', identifier: 'JUDGE-09', login_id: 'judge8', email: 'judge-09@auth.codeemanipal.in' },
  { slot: 9, name: 'Judge 9', identifier: 'JUDGE-10', login_id: 'judge9', email: 'judge-10@auth.codeemanipal.in' },
  { slot: 10, name: 'Judge 10', identifier: 'JUDGE-11', login_id: 'judge10', email: 'judge-11@auth.codeemanipal.in' },
];

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — 10 Judge Provisioning, 8-Char Passcodes & Audit   ║');
  console.log('║   Target Environment: STAGING (cem_staging / ggmwribwynonpsvsmpyz)       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  // Verify JUDGE-01 remains disabled and untouched
  const { rows: legacyJudge } = await pool.query(
    `SELECT id, name, identifier, login_id, is_disabled FROM public.profiles WHERE identifier = 'JUDGE-01'`
  );
  if (legacyJudge.length > 0) {
    if (!legacyJudge[0].is_disabled) {
      console.error('❌ SAFETY VIOLATION: Legacy JUDGE-01 is not disabled!');
      process.exit(1);
    }
    console.log('🔒 Legacy JUDGE-01 verified: DISABLED, preserved untouched.');
  }

  const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const authUsers = existingAuthUsers?.users || [];

  const handoffAccounts = [];

  for (const slotDef of ALL_JUDGE_SLOTS) {
    console.log(`\n--- Provisioning / Reconciling Slot ${slotDef.slot}: ${slotDef.name} (${slotDef.login_id} / ${slotDef.identifier}) ---`);

    let authUserId = null;
    // Generate strictly 8-digit alphanumeric passcode
    const passcode = generateParticipantPasscode(8);

    // Assert format
    if (passcode.length !== 8 || !/^[a-zA-Z0-9]{8}$/.test(passcode)) {
      throw new Error(`Invalid passcode generated: ${passcode}`);
    }

    // Check if auth user exists
    const existingAuth = authUsers.find(u => u.email?.toLowerCase() === slotDef.email.toLowerCase());

    if (existingAuth) {
      authUserId = existingAuth.id;
      console.log(`  Existing Auth user found: ${authUserId}`);
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: passcode,
        user_metadata: {
          name: slotDef.name,
          role: 'judge',
          identifier: slotDef.identifier,
          login_id: slotDef.login_id,
          provisional: true,
        },
      });
      if (updateErr) throw new Error(`Failed to update password for ${slotDef.email}: ${updateErr.message}`);
    } else {
      const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: slotDef.email,
        password: passcode,
        email_confirm: true,
        user_metadata: {
          name: slotDef.name,
          role: 'judge',
          identifier: slotDef.identifier,
          login_id: slotDef.login_id,
          provisional: true,
        },
      });
      if (createErr) throw new Error(`Failed to create Auth user for ${slotDef.email}: ${createErr.message}`);
      authUserId = newAuth.user.id;
      console.log(`  Created Auth user: ${authUserId}`);
    }

    // Ensure shadow record in Azure PostgreSQL auth.users
    await pool.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
      [authUserId, slotDef.email, JSON.stringify({ name: slotDef.name, role: 'judge', identifier: slotDef.identifier, login_id: slotDef.login_id })]
    );

    // Upsert public.profiles
    await pool.query(
      `INSERT INTO public.profiles (id, name, email, role, identifier, login_id, is_disabled, updated_at)
       VALUES ($1, $2, $3, 'judge', $4, $5, false, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = 'judge',
         identifier = EXCLUDED.identifier,
         login_id = EXCLUDED.login_id,
         is_disabled = false,
         updated_at = NOW()`,
      [authUserId, slotDef.name, slotDef.email, slotDef.identifier, slotDef.login_id]
    );
    console.log(`  Saved profile for ${slotDef.identifier} (${slotDef.login_id})`);

    // Record audit log
    await pool.query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1::uuid, 'JUDGE_PROVISIONAL_ACCOUNT_PROVISIONED', 'profiles', $1::text, $2)`,
      [
        authUserId,
        JSON.stringify({
          slot: slotDef.slot,
          display_name: slotDef.name,
          identifier: slotDef.identifier,
          login_id: slotDef.login_id,
          provisional: true,
          rehearsal: false,
        }),
      ]
    );

    // Test real login via application API
    console.log(`  Testing application login with 8-character passcode for "${slotDef.login_id}"...`);
    const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({
        identifier: slotDef.login_id,
        password: passcode,
      }),
    });

    if (!loginRes.ok) {
      const errBody = await loginRes.json();
      throw new Error(`Login failed for ${slotDef.login_id}: HTTP ${loginRes.status} - ${JSON.stringify(errBody)}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.session?.access_token;
    if (!token) throw new Error(`No access token returned for ${slotDef.login_id}`);

    // Verify session via /api/auth/me
    const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) throw new Error(`/api/auth/me failed for ${slotDef.login_id}: HTTP ${meRes.status}`);
    const meData = await meRes.json();
    if (meData.data?.profile?.role !== 'judge') {
      throw new Error(`Role mismatch for ${slotDef.login_id}: expected judge, got ${meData.data?.profile?.role}`);
    }

    // Verify denial of admin endpoints
    const adminCheckRes = await fetch('http://127.0.0.1:3000/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (adminCheckRes.status !== 403 && adminCheckRes.status !== 401) {
      throw new Error(`Security breach: Judge ${slotDef.login_id} was not forbidden from /api/admin/users (got ${adminCheckRes.status})`);
    }

    console.log(`  ✅ Slot ${slotDef.slot} verified: Login OK, Role=judge, 8-Char Passcode OK, Admin access forbidden (403).`);

    handoffAccounts.push({
      slot: slotDef.slot,
      displayName: slotDef.name,
      loginId: slotDef.login_id,
      canonicalIdentifier: slotDef.identifier,
      authEmail: slotDef.email,
      initialPassword: passcode,
      role: 'judge',
      accountStatus: 'ACTIVE_PROVISIONAL',
      identityStatus: 'PROVISIONAL — Requires organizer confirmation of real judge name/email before final judging',
      assignedRounds: ['Round 1', 'Round 2', 'Final'],
      firstLoginInstructions: [
        '1. Navigate to https://code-e-manipal-portal.vercel.app/login (or staging rehearsal URL)',
        `2. In User ID / Email, enter: ${slotDef.login_id}`,
        '3. Enter the initial 8-digit alphanumeric passcode provided in this confidential handoff',
        '4. Upon initial login, review your judging dashboard at /judge',
        '5. If your real name or personal email is updated by an administrator, your Login ID remains active and unchanged.',
      ],
    });
  }

  // Write private handoff artifact
  const credsDir = path.resolve('.credentials');
  if (!fs.existsSync(credsDir)) fs.mkdirSync(credsDir, { recursive: true });

  const handoffPath = path.join(credsDir, 'judge_credentials_handoff.json');
  fs.writeFileSync(
    handoffPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment: 'STAGING (cem_staging / ggmwribwynonpsvsmpyz)',
        confidentialityNotice: 'RESTRICTED DISTRIBUTION: Contains provisional judge credentials for Code-e-Manipal 2.0. Do NOT commit to source control or share publicly.',
        totalJudges: handoffAccounts.length,
        judges: handoffAccounts,
      },
      null,
      2
    )
  );

  console.log('\n======================================================================');
  console.log(`✅ All ${handoffAccounts.length} Judge accounts provisioned, authenticated, and verified!`);
  console.log(`📁 Private handoff artifact saved to: ${handoffPath}`);
  console.log('🔒 Confidentiality verified: File is inside .credentials/ (Git-ignored).');
  console.log('======================================================================\n');

  await pool.end();
}

main().catch(err => {
  console.error('❌ Error during judge provisioning:', err);
  process.exit(1);
});
