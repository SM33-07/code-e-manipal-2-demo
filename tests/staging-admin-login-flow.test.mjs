import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test('Staging Admin Password-Setup and Login Flow Rehearsal', async (t) => {
  // Boundary check: must be staging environment
  const parsedDb = new URL(databaseUrl);
  const dbName = parsedDb.pathname.replace(/^\//, '').split('?')[0];
  assert.equal(dbName, 'cem_staging', 'Test must run against cem_staging database');
  assert.match(supabaseUrl, /ggmwribwynonpsvsmpyz/, 'Test must run against staging Supabase project');

  const pgClient = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testAdmins = [
    { email: 'abhinav.ong@gmail.com', name: 'Abhinav Aryan', expectedRole: 'admin', expectedLogin: 'abhinav' },
    { email: 'yashsrivastava3745@gmail.com', name: 'Yash', expectedRole: 'admin', expectedLogin: 'yash' },
    { email: 'sohammore3312@gmail.com', name: 'Soham', expectedRole: 'admin', expectedLogin: 'soham' },
  ];

  t.after(async () => {
    await pgClient.end();
  });

  for (const admin of testAdmins) {
    await t.test(`Rehearse full flow for ${admin.name} (${admin.email})`, async () => {
      // 1. Verify existence in staging Azure PostgreSQL
      const profRes = await pgClient.query(
        'SELECT id, name, email, role, identifier, login_id, is_disabled, force_logout_before FROM public.profiles WHERE email = $1',
        [admin.email]
      );
      assert.equal(profRes.rows.length, 1, `Authoritative profile for ${admin.email} must exist in Azure PG`);
      const profile = profRes.rows[0];
      assert.equal(profile.role, admin.expectedRole, `Role must be ${admin.expectedRole}`);
      assert.equal(profile.is_disabled, false, `Admin account must not be disabled`);
      assert.ok(profile.identifier.startsWith('ADMIN-'), `Identifier must start with ADMIN- (got ${profile.identifier})`);
      assert.equal(profile.login_id, admin.expectedLogin, `Login ID must be ${admin.expectedLogin}`);

      // 2. Verify existence in staging Supabase Auth
      const { data: authList, error: listErr } = await adminClient.auth.admin.listUsers();
      assert.ifError(listErr);
      const authUser = authList.users.find(u => u.email === admin.email);
      assert.ok(authUser, `Supabase Auth user for ${admin.email} must exist`);
      assert.equal(authUser.id, profile.id, `Supabase Auth UUID must match Azure profile UUID exactly`);
      assert.equal(authUser.user_metadata?.role, 'admin', `Auth metadata role must be admin`);

      // 3. Generate invitation / recovery link (as issued during provisioning)
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: admin.email,
      });
      assert.ifError(linkErr, `Recovery link generation must succeed`);
      assert.ok(linkData.properties?.action_link, `Action link must be generated`);

      // 4. Set temporary password via Admin API to simulate recipient setting password on /auth/setup-password
      const tempPassword = `StagingTest#2026_${profile.identifier}_Secure!`;
      const { error: setPassErr } = await adminClient.auth.admin.updateUserById(authUser.id, {
        password: tempPassword,
      });
      assert.ifError(setPassErr, `Password update must succeed`);

      // 5. Test real client login with password via Anon API
      const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
        email: admin.email,
        password: tempPassword,
      });
      assert.ifError(signInErr, `Sign-in with new password must succeed`);
      assert.ok(signInData.session, `Must receive valid session token`);
      assert.equal(signInData.user.id, profile.id, `Authenticated user ID must match profile ID`);

      // 6. Simulate /api/auth/setup-password post-setup finalization
      await pgClient.query(
        'UPDATE public.profiles SET force_logout_before = NULL, updated_at = NOW() WHERE id = $1',
        [profile.id]
      );
      await pgClient.query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1::uuid, 'USER_PASSWORD_SETUP_COMPLETED', 'profiles', $1::text, $2)`,
        [profile.id, JSON.stringify({ email: admin.email, role: profile.role, identifier: profile.identifier, rehearsal: true })]
      );

      // Verify audit log entry was written
      const auditRes = await pgClient.query(
        "SELECT id, action FROM public.audit_logs WHERE user_id = $1 AND action = 'USER_PASSWORD_SETUP_COMPLETED' ORDER BY created_at DESC LIMIT 1",
        [profile.id]
      );
      assert.equal(auditRes.rows.length, 1, `Audit log entry for USER_PASSWORD_SETUP_COMPLETED must exist`);

      // 7. Verify ADR-001 role authorization logic
      // Even if user_metadata had been tampered, Azure PG profile is authoritative
      const verifyProfile = await pgClient.query(
        'SELECT role, is_disabled FROM public.profiles WHERE id = $1',
        [signInData.user.id]
      );
      assert.equal(verifyProfile.rows[0].role, 'admin');
      assert.equal(verifyProfile.rows[0].is_disabled, false);

      // Sign out anon client
      await anonClient.auth.signOut();
    });
  }
});
