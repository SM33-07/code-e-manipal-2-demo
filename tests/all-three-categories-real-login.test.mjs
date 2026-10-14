import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

async function runThreeCategoriesTest() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — Three Account Categories Real Login Test Suite    ║');
  console.log('║   Target: Real Local HTTP Endpoint (http://127.0.0.1:3000) on STAGING    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;

  // ── 1. Administrators ──
  console.log('--- 1. Testing Administrators (All 3 Active Admins) ---');
  const admins = [
    { loginId: 'abhinav', identifier: 'ADMIN-02', email: 'abhinav.ong@gmail.com' },
    { loginId: 'yash', identifier: 'ADMIN-03', email: 'yashsrivastava3745@gmail.com' },
    { loginId: 'soham', identifier: 'ADMIN-04', email: 'sohammore3312@gmail.com' },
  ];

  for (const adm of admins) {
    const password = `StagingTest#2026_${adm.identifier}_Secure!`;

    // A. Login with loginId
    const resA = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({ identifier: adm.loginId, password }),
    });
    assert.equal(resA.status, 200, `Admin ${adm.loginId} login must return 200`);
    const dataA = await resA.json();
    const tokenA = dataA.data?.session?.access_token;
    assert.ok(tokenA, `Admin ${adm.loginId} must receive access token`);

    // B. Login with canonical identifier
    const resB = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({ identifier: adm.identifier, password }),
    });
    assert.equal(resB.status, 200, `Admin ${adm.identifier} login must return 200`);

    // C. Hydrate /api/auth/me
    const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.data?.profile?.role, 'admin', `Role must be admin`);

    // D. Admin endpoint authorization
    const adminRes = await fetch('http://127.0.0.1:3000/api/admin/users', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(adminRes.status, 200, `Admin operations must return 200`);

    passed += 4;
    console.log(`✅ Admin ${adm.loginId} (${adm.identifier}) fully verified.`);
  }

  // ── 2. Judges ──
  console.log('\n--- 2. Testing Judges (All 10 Active Judges with 8-Char Passcodes) ---');
  const handoffPath = path.resolve('.credentials/judge_credentials_handoff.json');
  assert.ok(fs.existsSync(handoffPath), 'Judge handoff file must exist');
  const judges = JSON.parse(fs.readFileSync(handoffPath, 'utf8')).judges;
  assert.equal(judges.length, 10, 'Must have 10 judges');

  for (const j of judges) {
    const resA = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({ identifier: j.loginId, password: j.initialPassword }),
    });
    assert.equal(resA.status, 200, `Judge ${j.loginId} login must return 200`);
    const dataA = await resA.json();
    const tokenA = dataA.data?.session?.access_token;
    assert.ok(tokenA, `Judge ${j.loginId} must receive access token`);

    // Hydrate /api/auth/me
    const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.data?.profile?.role, 'judge', `Role must be judge`);

    // Verify admin operations are rejected (403)
    const adminRes = await fetch('http://127.0.0.1:3000/api/admin/users', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(adminRes.status, 403, `Judge must be denied admin access`);

    passed += 3;
    console.log(`✅ Judge Slot ${j.slot} (${j.loginId}) fully verified.`);
  }

  // ── 3. Participants ──
  console.log('\n--- 3. Testing Participants (Sampled Teams) ---');
  const teamCredsPath = path.resolve('.credentials/official_event_team_credentials.json');
  assert.ok(fs.existsSync(teamCredsPath), 'Team credentials file must exist');
  const teams = JSON.parse(fs.readFileSync(teamCredsPath, 'utf8'));

  const sampleTeams = [teams[0], teams[41], teams[85]]; // TEAM001, TEAM042, TEAM086
  for (const t of sampleTeams) {
    const resA = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
      body: JSON.stringify({
        identifier: t.loginId,
        password: t.officialPasscode,
        session_id: `test_reconnect_sess_${t.teamId}`,
      }),
    });
    assert.equal(resA.status, 200, `Team ${t.loginId} login must return 200`);
    const dataA = await resA.json();
    const tokenA = dataA.data?.session?.access_token;
    assert.ok(tokenA, `Team ${t.loginId} must receive access token`);

    // Hydrate /api/auth/me
    const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.data?.profile?.role, 'participant', `Role must be participant`);

    passed += 2;
    console.log(`✅ Team ${t.loginId} (${t.canonicalIdentifier}) fully verified.`);
  }

  // ── 4. Negative Security Tests ──
  console.log('\n--- 4. Negative Security Tests ---');
  // Wrong password
  const badRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
    body: JSON.stringify({ identifier: 'soham', password: 'WrongPassword999!' }),
  });
  assert.equal(badRes.status, 401, 'Wrong password must return 401');
  const badBody = await badRes.json();
  assert.equal(badBody.error, 'Invalid identifier or password.', 'Generic error required');

  // Unknown identifier
  const unknownRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
    body: JSON.stringify({ identifier: 'nonexistent_user', password: 'SomePassword123!' }),
  });
  assert.equal(unknownRes.status, 401, 'Unknown user must return 401');
  const unknownBody = await unknownRes.json();
  assert.equal(unknownBody.error, 'Invalid identifier or password.', 'Generic error required');

  passed += 2;
  console.log('✅ Negative security tests verified.');

  console.log('\n======================================================================');
  console.log(`Three Account Categories Acceptance: ${passed} / ${passed} passed!`);
  console.log('======================================================================\n');
}

runThreeCategoriesTest().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
