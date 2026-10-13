import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test('Supabase Auth GoTrue API: Caller-Supplied ID Acceptance Test', async (t) => {
  // Safety Boundary: verify running against staging Supabase project
  assert.ok(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required');
  assert.ok(supabaseServiceKey, 'SUPABASE_SERVICE_ROLE_KEY is required');
  assert.match(
    supabaseUrl,
    /ggmwribwynonpsvsmpyz/,
    'Integration test must run against staging Supabase project (ggmwribwynonpsvsmpyz)'
  );

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const callerSuppliedUuid = crypto.randomUUID();
  const testEmail = `integration-uuid-test-${Date.now()}@learnit-muj.internal`;

  t.after(async () => {
    // Teardown: ensure test identity is purged
    try {
      await supabase.auth.admin.deleteUser(callerSuppliedUuid);
    } catch (_) {}
  });

  await t.test('1. GoTrue createUser accepts caller-supplied id', async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      id: callerSuppliedUuid,
      email: testEmail,
      email_confirm: true,
      user_metadata: { role: 'admin', test: 'caller_supplied_id' },
    });

    assert.ifError(error, `GoTrue createUser returned unexpected error: ${error?.message}`);
    assert.ok(data.user, 'GoTrue must return created user');
    assert.equal(
      data.user.id,
      callerSuppliedUuid,
      `GoTrue MUST adopt the caller-supplied id. Expected ${callerSuppliedUuid}, got ${data.user.id}`
    );
    assert.equal(data.user.email, testEmail);
  });

  await t.test('2. GoTrue getUserById retrieves identity under caller-supplied id', async () => {
    const { data, error } = await supabase.auth.admin.getUserById(callerSuppliedUuid);
    assert.ifError(error, `getUserById failed: ${error?.message}`);
    assert.ok(data.user);
    assert.equal(data.user.id, callerSuppliedUuid);
    assert.equal(data.user.email, testEmail);
  });

  await t.test('3. Cleanup: deleteUser cleanly purges identity', async () => {
    const { error: delErr } = await supabase.auth.admin.deleteUser(callerSuppliedUuid);
    assert.ifError(delErr, `deleteUser failed: ${delErr?.message}`);

    const { data: verifyData } = await supabase.auth.admin.getUserById(callerSuppliedUuid);
    assert.equal(verifyData?.user, null, 'User should not exist after deletion');
  });
});
