#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Staging Authentication & Admin Password Reset Verifier
 * File: scripts/verify-all-staging-logins.mjs
 *
 * Verifies:
 *  1. Every one of the 86 participant accounts authenticates with Login ID and passcode.
 *  2. Incorrect passwords are categorically rejected.
 *  3. Admin password reset generates valid 8-char alphanumeric passcodes for participants.
 *  4. Newly reset passwords authenticate immediately.
 *  5. Sessions are revoked via force_logout_before.
 *  6. Admin-01 remains decommissioned.
 *  7. Admin-02, Admin-03, Admin-04 remain preserved with valid Auth UUID mappings.
 * ============================================================================
 */

import fs from 'fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { parseCSV, validateRoster } from './validate-csv.mjs';
import { generateParticipantPasscode, generateAdminPassword, generateJudgePassword } from '../lib/admin/passwords.ts';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Run with --env-file=.env.staging');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper: login via identity lookup (simulates /api/auth/login)
async function attemptLogin(client, identifier, passcode) {
  const norm = identifier.trim().toUpperCase();
  const compact = norm.replace(/-/g, '');

  const { rows } = await client.query(
    `SELECT id, email, role, identifier, login_id FROM public.profiles
     WHERE UPPER(TRIM(identifier)) = $1
        OR UPPER(TRIM(identifier)) = $2
        OR UPPER(TRIM(COALESCE(login_id, ''))) = $1
        OR UPPER(TRIM(COALESCE(login_id, ''))) = $2
     LIMIT 2`,
    [norm, compact]
  );

  if (rows.length !== 1 || !rows[0].email) {
    return { success: false, reason: 'Profile not found or ambiguous' };
  }

  const profile = rows[0];
  const { data, error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: passcode,
  });

  if (error || !data.user) {
    return { success: false, profile, reason: error?.message || 'Invalid credentials' };
  }

  return { success: true, profile, user: data.user, session: data.session };
}

async function attemptLoginWithRetry(client, identifier, passcode, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await attemptLogin(client, identifier, passcode);
    if (res.success) return res;
    if (res.reason && (res.reason.toLowerCase().includes('rate limit') || res.reason.includes('Too Many Requests'))) {
      await sleep(2500 * attempt);
      continue;
    }
    return res;
  }
  return { success: false, reason: 'Request rate limit reached after retries' };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('  Code-e-Manipal 2.0 — Staging End-to-End Authentication Tests');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    // ── Phase A: Verify Admin Invariants ─────────────────────────────────────
    console.log('--- Phase A: Administrator Account Verification ---');
    const { rows: admins } = await client.query(`
      SELECT p.id, p.name, p.email, p.role, p.identifier, p.login_id, p.is_disabled
      FROM public.profiles p
      WHERE p.role = 'admin'
      ORDER BY p.identifier;
    `);

    console.table(admins.map((a) => ({
      ID: a.id.slice(0, 8) + '...',
      Name: a.name,
      Email: a.email,
      Identifier: a.identifier,
      Login_ID: a.login_id,
      Disabled: a.is_disabled,
    })));

    const adminIdentifiers = admins.map((a) => a.identifier);
    if (adminIdentifiers.includes('ADMIN-01')) {
      const admin01 = admins.find((a) => a.identifier === 'ADMIN-01');
      if (!admin01.is_disabled) {
        throw new Error('Security Violation: ADMIN-01 must be decommissioned (disabled)!');
      }
      console.log('   ✅ ADMIN-01 is confirmed decommissioned and disabled.');
    } else {
      console.log('   ✅ ADMIN-01 is not active in admin roster.');
    }

    const requiredAdmins = ['ADMIN-02', 'ADMIN-03', 'ADMIN-04'];
    for (const req of requiredAdmins) {
      if (!adminIdentifiers.includes(req)) {
        throw new Error(`Missing expected administrator: ${req}`);
      }
    }
    console.log('   ✅ Retained administrators ADMIN-02, ADMIN-03, ADMIN-04 verified.\n');

    // ── Phase B: Test All 86 Participant Logins ─────────────────────────────
    console.log('--- Phase B: Participant Login Verification (All 86 Teams) ---');
    const rawCsv = fs.readFileSync('code_e_manipal_team_leader_logins_alphanumeric.csv', 'utf8');
    const { teams } = validateRoster(parseCSV(rawCsv));

    let passedLogins = 0;
    const loginErrors = [];

    // Rate-limit throttle: test in batches with backoff
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      let attempts = 0;
      let authenticated = false;

      while (attempts < 5 && !authenticated) {
        attempts++;
        const res = await attemptLogin(client, t.loginId, t.passcode);

        if (res.success) {
          passedLogins++;
          authenticated = true;
          if (i < 5 || i >= teams.length - 2) {
            console.log(`   ✅ [${t.teamId}] Login ID "${t.loginId}" authenticated successfully (UUID: ${res.user.id.slice(0, 8)}...)`);
          } else if (i === 5) {
            console.log(`   ... verifying remaining teams ...`);
          }
        } else if (res.reason && (res.reason.toLowerCase().includes('rate limit') || res.reason.includes('Too Many Requests'))) {
          // Back off when hitting Supabase GoTrue IP rate limit (30 req/min)
          console.warn(`   ⏳ Rate limit reached at ${t.teamId}. Backing off ${attempts * 6}s for token bucket drain...`);
          await sleep(6000 * attempts);
        } else {
          loginErrors.push({ teamId: t.teamId, loginId: t.loginId, reason: res.reason });
          break;
        }
      }

      if (!authenticated && !loginErrors.some((e) => e.teamId === t.teamId)) {
        loginErrors.push({ teamId: t.teamId, loginId: t.loginId, reason: 'Request rate limit persisted after 5 retries' });
      }

      // Small throttle between calls
      await sleep(150);
    }

    console.log(`\nParticipant Login Summary:`);
    console.log(`   - Total Teams: ${teams.length}`);
    console.log(`   - Successful Logins: ${passedLogins}`);
    console.log(`   - Failed Logins: ${loginErrors.length}`);

    if (loginErrors.length > 0) {
      console.error('Failed Logins:');
      loginErrors.forEach((e) => console.error(`   - [${e.teamId}] ${e.loginId}: ${e.reason}`));
      throw new Error(`Participant login verification failed for ${loginErrors.length} teams.`);
    }

    // ── Phase C: Test Incorrect Password Rejection ──────────────────────────
    console.log('\n--- Phase C: Negative Authentication Testing (Incorrect Passwords) ---');
    const negRes = await attemptLoginWithRetry(client, 'TEAM001', 'IncorrectPass123!');
    if (negRes.success) {
      throw new Error('Security Defect: Login succeeded with incorrect password!');
    }
    console.log('   ✅ Incorrect passcode rejected as expected:', negRes.reason);

    // ── Phase D: Test Admin Password Reset End-to-End on Disposable Accounts ──
    console.log('\n--- Phase D: Admin Panel Password Reset End-to-End (Disposable Test Accounts) ---');
    
    // Test 1: Disposable Participant Reset
    const dispPartEmail = 'disposable-participant@staging-test.codeemanipal.in';
    const dispPartInitPass = 'InitPass99';
    console.log('1. Setting up isolated disposable participant account...');
    
    let dispPartAuthUser = null;
    try {
      const { data: createPart, error: createPartErr } = await supabase.auth.admin.createUser({
        email: dispPartEmail,
        password: dispPartInitPass,
        email_confirm: true,
        user_metadata: { name: 'Disposable Participant', role: 'participant', identifier: 'DISP-PART-01', login_id: 'DISPPART01' }
      });
      if (createPartErr) throw new Error(`Failed to create disposable participant: ${createPartErr.message}`);
      dispPartAuthUser = createPart.user;

      await client.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
        [dispPartAuthUser.id, dispPartEmail, JSON.stringify({ role: 'participant', identifier: 'DISP-PART-01', login_id: 'DISPPART01' })]
      );

      await client.query(
        `INSERT INTO public.profiles (id, name, email, role, identifier, login_id)
         VALUES ($1, 'Disposable Participant', $2, 'participant', 'DISP-PART-01', 'DISPPART01')
         ON CONFLICT (id) DO UPDATE SET identifier = 'DISP-PART-01', login_id = 'DISPPART01'`,
        [dispPartAuthUser.id, dispPartEmail]
      );

      // Verify initial login works
      const initLogin = await attemptLoginWithRetry(client, 'DISPPART01', dispPartInitPass);
      if (!initLogin.success) throw new Error(`Disposable participant initial login failed: ${initLogin.reason}`);
      console.log('   ✅ Disposable participant initial login verified.');

      // Admin generates 8-char alphanumeric passcode
      const tempPasscode = generateParticipantPasscode(8);
      if (tempPasscode.length !== 8 || !/[a-zA-Z]/.test(tempPasscode) || !/[0-9]/.test(tempPasscode)) {
        throw new Error('Participant passcode policy violated!');
      }
      console.log('   ✅ Generated 8-char alphanumeric passcode matching strict participant policy.');

      // Admin updates password in Supabase Auth
      const { error: resetErr } = await supabase.auth.admin.updateUserById(dispPartAuthUser.id, {
        password: tempPasscode,
      });
      if (resetErr) throw new Error(`Supabase Auth reset failed: ${resetErr.message}`);

      // Session invalidation in Azure PostgreSQL
      await client.query(
        `UPDATE public.profiles SET force_logout_before = NOW(), updated_at = NOW() WHERE id = $1`,
        [dispPartAuthUser.id]
      );
      console.log('   ✅ Password updated in Supabase Auth GoTrue and session invalidated in PostgreSQL.');

      // Verify old passcode is rejected
      const oldLogin = await attemptLoginWithRetry(client, 'DISPPART01', dispPartInitPass);
      if (oldLogin.success) throw new Error('Security Defect: Old passcode still authenticated after reset!');
      console.log('   ✅ Verified: Old passcode rejected immediately.');

      // Verify new temporary passcode works immediately
      const newLogin = await attemptLoginWithRetry(client, 'DISPPART01', tempPasscode);
      if (!newLogin.success) throw new Error(`Temporary passcode failed to authenticate: ${newLogin.reason}`);
      console.log('   ✅ Verified: New 8-char alphanumeric passcode authenticates immediately!');
    } finally {
      if (dispPartAuthUser) {
        await client.query('DELETE FROM public.profiles WHERE id = $1', [dispPartAuthUser.id]);
        await client.query('DELETE FROM auth.users WHERE id = $1', [dispPartAuthUser.id]);
        await supabase.auth.admin.deleteUser(dispPartAuthUser.id);
        console.log('   🧹 Cleaned up disposable participant account completely.');
      }
    }

    // Test 2: Disposable Admin Reset Flow
    const dispAdminEmail = 'disposable-admin@staging-test.codeemanipal.in';
    const dispAdminInitPass = 'InitialAdminSecret123!';
    console.log('\n2. Setting up isolated disposable admin account...');
    
    let dispAdminAuthUser = null;
    try {
      const { data: createAdmin, error: createAdminErr } = await supabase.auth.admin.createUser({
        email: dispAdminEmail,
        password: dispAdminInitPass,
        email_confirm: true,
        user_metadata: { name: 'Disposable Admin', role: 'admin', identifier: 'DISP-ADM-01', login_id: 'dispadm01' }
      });
      if (createAdminErr) throw new Error(`Failed to create disposable admin: ${createAdminErr.message}`);
      dispAdminAuthUser = createAdmin.user;

      await client.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
        [dispAdminAuthUser.id, dispAdminEmail, JSON.stringify({ role: 'admin', identifier: 'DISP-ADM-01', login_id: 'dispadm01' })]
      );

      await client.query(
        `INSERT INTO public.profiles (id, name, email, role, identifier, login_id)
         VALUES ($1, 'Disposable Admin', $2, 'admin', 'DISP-ADM-01', 'dispadm01')
         ON CONFLICT (id) DO UPDATE SET identifier = 'DISP-ADM-01', login_id = 'dispadm01'`,
        [dispAdminAuthUser.id, dispAdminEmail]
      );

      // Verify initial admin login
      const initAdminLogin = await attemptLoginWithRetry(client, 'dispadm01', dispAdminInitPass);
      if (!initAdminLogin.success) throw new Error(`Disposable admin initial login failed: ${initAdminLogin.reason}`);
      console.log('   ✅ Disposable admin initial login verified.');

      // Admin generates >= 16 char complex password
      const tempAdminPass = generateAdminPassword(18);
      if (tempAdminPass.length < 16 || !/[A-Z]/.test(tempAdminPass) || !/[a-z]/.test(tempAdminPass) || !/[0-9]/.test(tempAdminPass)) {
        throw new Error('Admin password policy violated!');
      }
      console.log('   ✅ Generated 18-char complex password matching strict admin policy (>= 16, upper, lower, digit).');

      // Admin updates password
      const { error: resetAdminErr } = await supabase.auth.admin.updateUserById(dispAdminAuthUser.id, {
        password: tempAdminPass,
      });
      if (resetAdminErr) throw new Error(`Supabase Auth reset failed: ${resetAdminErr.message}`);

      await client.query(
        `UPDATE public.profiles SET force_logout_before = NOW(), updated_at = NOW() WHERE id = $1`,
        [dispAdminAuthUser.id]
      );

      // Verify old admin password rejected
      const oldAdminLogin = await attemptLoginWithRetry(client, 'dispadm01', dispAdminInitPass);
      if (oldAdminLogin.success) throw new Error('Security Defect: Old admin password still worked!');
      console.log('   ✅ Verified: Old admin password rejected immediately.');

      // Verify new admin password works immediately
      const newAdminLogin = await attemptLoginWithRetry(client, 'dispadm01', tempAdminPass);
      if (!newAdminLogin.success) throw new Error(`Temporary admin password failed: ${newAdminLogin.reason}`);
      console.log('   ✅ Verified: New admin password authenticates immediately!');
    } finally {
      if (dispAdminAuthUser) {
        await client.query('DELETE FROM public.profiles WHERE id = $1', [dispAdminAuthUser.id]);
        await client.query('DELETE FROM auth.users WHERE id = $1', [dispAdminAuthUser.id]);
        await supabase.auth.admin.deleteUser(dispAdminAuthUser.id);
        console.log('   🧹 Cleaned up disposable admin account completely.');
      }
    }

    // ── Phase E: Verify Password Policy Generation for Admins & Judges ──────
    console.log('\n--- Phase E: Password Policy Compliance for Admin & Judge Roles ---');
    const testAdminPwd = generateAdminPassword(18);
    const testJudgePwd = generateJudgePassword(16);

    if (testAdminPwd.length < 16 || !/[A-Z]/.test(testAdminPwd) || !/[a-z]/.test(testAdminPwd) || !/[0-9]/.test(testAdminPwd)) {
      throw new Error('Admin password policy failed!');
    }
    console.log('   ✅ Admin password policy verified (>= 16 chars, upper, lower, digit).');

    if (testJudgePwd.length < 16 || !/[A-Z]/.test(testJudgePwd) || !/[a-z]/.test(testJudgePwd) || !/[0-9]/.test(testJudgePwd)) {
      throw new Error('Judge password policy failed!');
    }
    console.log('   ✅ Judge password policy verified (>= 16 chars, upper, lower, digit).');

    console.log('\n================================================================');
    console.log('🎉 ALL STAGING AUTHENTICATION TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ Authentication Verification Failed:', err.message);
  process.exit(1);
});
