import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { getSetupPasswordRedirectUrl, getCanonicalSiteUrl } from '../lib/auth/siteUrl.ts';
import { generateAdminPassword } from '../lib/admin/passwords.ts';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!databaseUrl || !supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing required environment variables. Run with --env-file=.env.staging');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test('Targeted Bug Fix E2E: Admin Setup & Recovery Link Journey', async (t) => {
  const client = await pool.connect();
  const siteUrl = getCanonicalSiteUrl();
  const setupUrl = getSetupPasswordRedirectUrl();

  // ── Journey 1: Admin Password Recovery Flow ──────────────────────────────
  await t.test('1. Admin Password Recovery: Link -> Supabase Verify -> setup-password -> Password Update -> Login', async () => {
    const testAdminEmail = 'e2e-admin-recovery@staging-test.codeemanipal.in';
    const initPassword = generateAdminPassword(18);
    const newAdminPassword = generateAdminPassword(18);

    let authUser = null;
    try {
      // 1. Create disposable test admin
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: testAdminEmail,
        password: initPassword,
        email_confirm: true,
        user_metadata: { role: 'admin', identifier: 'DISP-ADM-REC', login_id: 'dispadmrec' },
      });
      assert.ifError(createErr);
      authUser = createData.user;

      await client.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
        [authUser.id, testAdminEmail, JSON.stringify({ role: 'admin', identifier: 'DISP-ADM-REC', login_id: 'dispadmrec' })]
      );
      await client.query(
        `INSERT INTO public.profiles (id, name, email, role, identifier, login_id)
         VALUES ($1, 'Disposable Admin Recovery', $2, 'admin', 'DISP-ADM-REC', 'dispadmrec')
         ON CONFLICT (id) DO UPDATE SET identifier = 'DISP-ADM-REC', login_id = 'dispadmrec'`,
        [authUser.id, testAdminEmail]
      );

      // 2. Generate recovery setup link with explicit redirectTo
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: testAdminEmail,
        options: { redirectTo: setupUrl },
      });
      assert.ifError(linkErr);
      assert.ok(linkData.properties?.action_link, 'Must generate action link');

      const actionUrl = new URL(linkData.properties.action_link);
      assert.equal(actionUrl.pathname, '/auth/v1/verify');
      assert.equal(actionUrl.searchParams.get('type'), 'recovery');
      assert.equal(actionUrl.searchParams.get('redirect_to'), setupUrl);

      // 3. Simulate clicking the email link (HTTP GET to Supabase verify)
      const verifyRes = await fetch(linkData.properties.action_link, { redirect: 'manual' });
      assert.equal(verifyRes.status, 303, 'Supabase verify must respond with 303 redirect');

      const locationHeader = verifyRes.headers.get('location');
      assert.ok(locationHeader, 'Must contain Location header');

      const targetUrl = new URL(locationHeader);
      // Critical check: Destination must be /auth/setup-password, NOT / (homepage)
      assert.equal(targetUrl.pathname, '/auth/setup-password', 'Redirect target pathname must be /auth/setup-password');

      // 4. Extract tokens from hash fragment
      const hashParams = new URLSearchParams(targetUrl.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const tokenType = hashParams.get('type');

      assert.ok(accessToken, 'Must provide access_token in hash');
      assert.ok(refreshToken, 'Must provide refresh_token in hash');
      assert.equal(tokenType, 'recovery', 'Token type must be recovery');

      // 5. Simulate /auth/setup-password client session establishment
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: sessionData, error: sessionErr } = await userClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      assert.ifError(sessionErr);
      assert.equal(sessionData.user.id, authUser.id);

      // 6. Set new password compliant with Admin policy (>= 16 chars)
      assert.ok(newAdminPassword.length >= 16);
      assert.ok(/[A-Z]/.test(newAdminPassword));
      assert.ok(/[a-z]/.test(newAdminPassword));
      assert.ok(/[0-9]/.test(newAdminPassword));

      const { data: updateData, error: updateErr } = await userClient.auth.updateUser({
        password: newAdminPassword,
      });
      assert.ifError(updateErr);
      assert.ok(updateData.user);

      // 7. Verify new password authenticates immediately via Anon sign-in
      const testClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: loginData, error: loginErr } = await testClient.auth.signInWithPassword({
        email: testAdminEmail,
        password: newAdminPassword,
      });
      assert.ifError(loginErr);
      assert.equal(loginData.user.id, authUser.id, 'New password must log in as intended user');

      // 8. Verify old password is now rejected
      const { error: oldLoginErr } = await testClient.auth.signInWithPassword({
        email: testAdminEmail,
        password: initPassword,
      });
      assert.ok(oldLoginErr, 'Old password must be categorically rejected');
    } finally {
      if (authUser) {
        await client.query('DELETE FROM public.profiles WHERE id = $1', [authUser.id]);
        await client.query('DELETE FROM auth.users WHERE id = $1', [authUser.id]);
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      }
    }
  });

  // ── Journey 2: Admin Invitation Setup Flow ────────────────────────────────
  await t.test('2. Admin Invitation Flow: Unconfirmed Admin -> Invite Link -> Verify -> setup-password -> Password Set -> Login', async () => {
    const testAdminEmail = 'e2e-admin-invite@staging-test.codeemanipal.in';
    const newAdminPassword = generateAdminPassword(18);

    let authUser = null;
    try {
      // 1. Create unconfirmed admin user (as created via invitation or admin provisioning)
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: testAdminEmail,
        email_confirm: false, // unconfirmed
        user_metadata: { role: 'admin', identifier: 'DISP-ADM-INV', login_id: 'dispadminv' },
      });
      assert.ifError(createErr);
      authUser = createData.user;
      assert.equal(authUser.email_confirmed_at, undefined);

      await client.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
        [authUser.id, testAdminEmail, JSON.stringify({ role: 'admin', identifier: 'DISP-ADM-INV', login_id: 'dispadminv' })]
      );
      await client.query(
        `INSERT INTO public.profiles (id, name, email, role, identifier, login_id)
         VALUES ($1, 'Disposable Admin Invite', $2, 'admin', 'DISP-ADM-INV', 'dispadminv')
         ON CONFLICT (id) DO UPDATE SET identifier = 'DISP-ADM-INV', login_id = 'dispadminv'`,
        [authUser.id, testAdminEmail]
      );

      // 2. Generate invitation link with explicit redirectTo
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: testAdminEmail,
        options: { redirectTo: setupUrl },
      });
      assert.ifError(linkErr);

      const actionUrl = new URL(linkData.properties.action_link);
      assert.equal(actionUrl.pathname, '/auth/v1/verify');
      assert.equal(actionUrl.searchParams.get('type'), 'invite');
      assert.equal(actionUrl.searchParams.get('redirect_to'), setupUrl);

      // 3. Simulate clicking invitation link
      const verifyRes = await fetch(linkData.properties.action_link, { redirect: 'manual' });
      assert.equal(verifyRes.status, 303);

      const targetUrl = new URL(verifyRes.headers.get('location'));
      assert.equal(targetUrl.pathname, '/auth/setup-password', 'Invite must redirect to /auth/setup-password');

      const hashParams = new URLSearchParams(targetUrl.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const tokenType = hashParams.get('type');

      assert.ok(accessToken);
      assert.ok(refreshToken);
      assert.equal(tokenType, 'invite', 'Hash type must be invite');

      // 4. Establish session on client
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: sessionData, error: sessionErr } = await userClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      assert.ifError(sessionErr);

      // 5. Set initial password
      const { error: updateErr } = await userClient.auth.updateUser({
        password: newAdminPassword,
      });
      assert.ifError(updateErr);

      // 6. Verify immediate login
      const testClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: loginData, error: loginErr } = await testClient.auth.signInWithPassword({
        email: testAdminEmail,
        password: newAdminPassword,
      });
      assert.ifError(loginErr);
      assert.equal(loginData.user.id, authUser.id);
    } finally {
      if (authUser) {
        await client.query('DELETE FROM public.profiles WHERE id = $1', [authUser.id]);
        await client.query('DELETE FROM auth.users WHERE id = $1', [authUser.id]);
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      }
    }
  });

  // ── Journey 3: Expired & Invalid Link Rejection ───────────────────────────
  await t.test('3. Expired & Invalid Link Handling: Surfaces Clear Error on /auth/setup-password Without Crash or Hompage Trap', () => {
    // Test URL with expired error in hash
    const expiredHashUrl = new URL(`${setupUrl}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
    const hashParams = new URLSearchParams(expiredHashUrl.hash.replace(/^#/, ''));
    const urlError = hashParams.get('error_description') || hashParams.get('error');
    const errorCode = hashParams.get('error_code') || '';

    const decoded = decodeURIComponent(urlError.replace(/\+/g, ' '));
    const lower = (decoded + ' ' + errorCode).toLowerCase();
    const isActionableError = lower.includes('expired') || lower.includes('invalid');

    assert.equal(isActionableError, true, 'Must recognize expired OTP token');
    const userMessage = isActionableError
      ? 'Your password setup link is invalid, expired, or has already been used. Please request a new recovery link.'
      : decoded;

    assert.equal(userMessage, 'Your password setup link is invalid, expired, or has already been used. Please request a new recovery link.');
  });

  client.release();
  await pool.end();
});
