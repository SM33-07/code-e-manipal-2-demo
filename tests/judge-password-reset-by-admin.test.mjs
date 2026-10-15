import assert from 'node:assert/strict';
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

async function runJudgeResetTests() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — Judge Password Reset by Admin Acceptance Suite    ║');
  console.log('║   Target: Local HTTP Endpoint (http://127.0.0.1:3000) on STAGING         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;

  // 1. Authenticate as Admin (Soham / ADMIN-04)
  console.log('1. Authenticating as administrator...');
  const adminLoginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
    body: JSON.stringify({ identifier: 'soham', password: 'StagingTest#2026_ADMIN-04_Secure!' }),
  });
  assert.equal(adminLoginRes.status, 200, 'Admin login must succeed');
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.data?.session?.access_token;
  assert.ok(adminToken, 'Admin token must be received');
  passed++;
  console.log('✅ Administrator authenticated.');

  // 2. Fetch Judge 7 profile from database
  const { rows: judgeRows } = await pool.query(
    "SELECT id, name, email, identifier, login_id FROM public.profiles WHERE identifier = 'JUDGE-08'"
  );
  assert.equal(judgeRows.length, 1, 'Judge 7 must exist in profiles');
  const judge7 = judgeRows[0];

  // 3. Admin Reset Judge 7 Password via Auto-generation (Empty body / reason only)
  console.log('\n2. Testing Admin Single-Click Auto-Reset on Judge 7 (JUDGE-08)...');
  const autoResetRes = await fetch(`http://127.0.0.1:3000/api/admin/users/${judge7.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:3000',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ reason: 'Judge password reset by admin test' }),
  });
  assert.equal(autoResetRes.status, 200, 'Auto-reset must return HTTP 200');
  const autoResetData = await autoResetRes.json();
  const newPasscode = autoResetData.data?.temporary_password;

  console.log('   Received generated temporary passcode format check...');
  assert.ok(newPasscode, 'Must return temporary password');
  assert.equal(newPasscode.length, 8, 'Judge passcode must be exactly 8 characters');
  assert.match(newPasscode, /^[a-zA-Z0-9]{8}$/, 'Must be alphanumeric');
  assert.match(newPasscode, /[a-zA-Z]/, 'Must contain letters');
  assert.match(newPasscode, /[0-9]/, 'Must contain numbers');
  passed += 2;
  console.log(`✅ 8-digit alphanumeric judge passcode successfully generated.`);

  // 4. Verify Judge 7 can log in with new 8-digit passcode
  console.log('3. Verifying Judge 7 login with newly generated 8-digit passcode...');
  const judgeLoginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
    body: JSON.stringify({ identifier: judge7.login_id, password: newPasscode }),
  });
  assert.equal(judgeLoginRes.status, 200, 'Judge login with new passcode must succeed');
  const judgeLoginData = await judgeLoginRes.json();
  const judgeToken = judgeLoginData.data?.session?.access_token;
  assert.ok(judgeToken, 'Judge token must be received');

  // Verify /api/auth/me
  const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
    headers: { Authorization: `Bearer ${judgeToken}` },
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.data?.profile?.role, 'judge');
  passed += 2;
  console.log('✅ Judge 7 logged in and hydrated /api/auth/me successfully.');

  // 5. Fetch Judge 8 profile from database
  const { rows: judge8Rows } = await pool.query(
    "SELECT id, name, email, identifier, login_id FROM public.profiles WHERE identifier = 'JUDGE-09'"
  );
  assert.equal(judge8Rows.length, 1, 'Judge 8 must exist in profiles');
  const judge8 = judge8Rows[0];

  // 6. Test Custom Password Reset Validation (Participant-style 8-digit alphanumeric)
  console.log('\n4. Testing Custom 8-Digit Alphanumeric Reset on Judge 8 (JUDGE-09)...');
  const customPasscode = 'Judge89X';
  const customResetRes = await fetch(`http://127.0.0.1:3000/api/admin/users/${judge8.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:3000',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ password: customPasscode }),
  });
  assert.equal(customResetRes.status, 200, 'Valid custom 8-digit alphanumeric reset must succeed');
  passed++;
  console.log('✅ Custom 8-digit alphanumeric reset returned HTTP 200.');

  // 7. Verify Judge 8 logs in with custom passcode
  const judge8LoginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' },
    body: JSON.stringify({ identifier: judge8.login_id, password: customPasscode }),
  });
  assert.equal(judge8LoginRes.status, 200, 'Judge 8 login with custom passcode must succeed');
  passed++;
  console.log('✅ Judge 8 logged in successfully with custom passcode.');

  // 8. Negative Tests for Judge Reset
  console.log('\n5. Negative Validation Tests for Judge Passcode Reset...');
  // Bad length (7 chars)
  const badLenRes = await fetch(`http://127.0.0.1:3000/api/admin/users/${judge8.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:3000',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ password: 'Short7X' }),
  });
  assert.equal(badLenRes.status, 400, 'Short passcode must be rejected with 400');

  // Letters only (no digits)
  const lettersOnlyRes = await fetch(`http://127.0.0.1:3000/api/admin/users/${judge8.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:3000',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ password: 'ABCDEFGH' }),
  });
  assert.equal(lettersOnlyRes.status, 400, 'Letters-only passcode must be rejected with 400');

  // Digits only (no letters)
  const digitsOnlyRes = await fetch(`http://127.0.0.1:3000/api/admin/users/${judge8.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:3000',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ password: '12345678' }),
  });
  assert.equal(digitsOnlyRes.status, 400, 'Digits-only passcode must be rejected with 400');

  // Symbols
  const symbolsRes = await fetch(`http://127.0.0.1:3000/api/admin/users/${judge8.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:3000',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ password: 'Jdg!2026' }),
  });
  assert.equal(symbolsRes.status, 400, 'Passcode with symbols must be rejected with 400');
  passed += 4;
  console.log('✅ Negative validation checks rejected invalid passcodes (400 Bad Request).');

  // 9. Synchronize handoff file with latest passcodes
  const handoffPath = path.resolve('.credentials/judge_credentials_handoff.json');
  if (fs.existsSync(handoffPath)) {
    const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
    const j7 = handoff.judges.find(j => j.canonicalIdentifier === 'JUDGE-08');
    if (j7) j7.initialPassword = newPasscode;
    const j8 = handoff.judges.find(j => j.canonicalIdentifier === 'JUDGE-09');
    if (j8) j8.initialPassword = customPasscode;
    fs.writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));
    console.log('\n✅ Synchronized .credentials/judge_credentials_handoff.json with active passcodes.');
  }

  console.log('\n======================================================================');
  console.log(`Judge Reset Acceptance Suite: ${passed} / ${passed} PASSED!`);
  console.log('======================================================================\n');

  await pool.end();
}

runJudgeResetTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
