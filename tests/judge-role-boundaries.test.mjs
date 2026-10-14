import assert from 'assert';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes('cem_staging')) {
  console.error('DATABASE_URL must target cem_staging');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function runJudgeBoundaryTests() {
  console.log('Running Six Judge Role Boundaries & Authorization Acceptance...\n');
  const handoffPath = path.resolve('.credentials/judge_credentials_handoff.json');
  assert(fs.existsSync(handoffPath), 'Handoff artifact must exist');

  const handoffData = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
  const judges = handoffData.judges;
  assert.ok(judges.length >= 6, 'Must have at least 6 judge accounts');

  let passed = 0;

  for (const j of judges) {
    // 1. Authenticate via real app endpoint
    const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({
        identifier: j.loginId,
        password: j.initialPassword,
      }),
    });
    assert.strictEqual(loginRes.status, 200, `Login for ${j.loginId} must succeed`);
    const loginJson = await loginRes.json();
    const token = loginJson.data?.session?.access_token;
    assert(token, `Access token must be present for ${j.loginId}`);

    // 2. Hydrate profile via /api/auth/me
    const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(meRes.status, 200, `/api/auth/me must return 200 for ${j.loginId}`);
    const meJson = await meRes.json();
    assert.strictEqual(meJson.data?.profile?.role, 'judge', `Role must be judge`);
    assert.strictEqual(meJson.data?.profile?.identifier, j.canonicalIdentifier);
    assert.strictEqual(meJson.data?.profile?.login_id, j.loginId);

    // 3. Admin operation denial
    const adminRes = await fetch('http://127.0.0.1:3000/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(adminRes.status, 403, `Judge must be denied admin access (403)`);

    // 4. Participant submission creation denial
    const subRes = await fetch('http://127.0.0.1:3000/api/submissions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Origin': 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({
        title: 'Judge Rogue Submission',
        track: 'AI/ML',
      }),
    });
    assert(
      subRes.status === 403 || subRes.status === 400 || subRes.status === 401,
      `Judge must not be permitted to create participant submissions (got ${subRes.status})`
    );

    passed++;
    console.log(`✅ Judge Slot ${j.slot} (${j.loginId} / ${j.canonicalIdentifier}): Auth, Role, Admin-Denial, Participant-Denial verified.`);
  }

  // 5. Test Revocation / Disabled Account Behavior for Slot 6
  console.log('\nTesting account disabling and revocation behavior...');
  const slot6 = judges[5];
  const { rows: prof6 } = await pool.query(
    'SELECT id FROM public.profiles WHERE login_id = $1',
    [slot6.loginId]
  );
  assert(prof6.length === 1);
  const slot6Id = prof6[0].id;

  try {
    // Disable account
    await pool.query('UPDATE public.profiles SET is_disabled = true WHERE id = $1', [slot6Id]);

    // Test login attempt fails
    const disabledLogin = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({
        identifier: slot6.loginId,
        password: slot6.initialPassword,
      }),
    });
    assert.strictEqual(disabledLogin.status, 401, 'Disabled account login must return 401');
    const disabledBody = await disabledLogin.json();
    assert.strictEqual(disabledBody.error, 'Invalid identifier or password.', 'Generic error required');

    console.log('✅ Disabled account login safely rejected with generic error.');
  } finally {
    // Restore enabled state
    await pool.query('UPDATE public.profiles SET is_disabled = false WHERE id = $1', [slot6Id]);
    console.log('✅ Slot 6 restored to enabled state.');
  }

  console.log(`\n======================================================`);
  console.log(`Six Judge Authorization Tests: ${passed} / 6 passed + revocation verified!`);
  console.log(`======================================================\n`);

  await pool.end();
}

runJudgeBoundaryTests().catch(err => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
