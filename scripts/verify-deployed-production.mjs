import fs from 'fs';

const credPath = '.credentials/official_event_team_credentials.json';
if (!fs.existsSync(credPath)) {
  console.error(`❌ Credentials file not found at ${credPath}. Place the credentials file or run locally where credentials exist.`);
  process.exit(1);
}

const teamCreds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
const team1 = teamCreds.find(t => t.teamId === 'TEAM001');
const team87 = teamCreds.find(t => t.teamId === 'TEAM087');

const deployedUrl = process.env.DEPLOYED_URL || 'https://code-e-manipal-portal.vercel.app';

async function testDeployedLogin(identifier, password, label) {
  console.log(`\n============================================================`);
  console.log(`Testing DEPLOYED PRODUCTION login for ${label} (${identifier})...`);
  console.log(`Target: ${deployedUrl}/api/auth/login`);

  const res = await fetch(`${deployedUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': deployedUrl,
    },
    body: JSON.stringify({ identifier, password }),
  });

  const status = res.status;
  const setCookie = res.headers.get('set-cookie');
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    data = { text: await res.text() };
  }

  console.log(`Status: ${status} ${status === 200 ? '✓ SUCCESS' : '✗ Status ' + status}`);
  if (status === 200) {
    console.log(`✓ Session established: ${!!setCookie}`);
    console.log(`✓ Authenticated Role: ${data.data?.profile?.role || data.role}`);
    console.log(`✓ Profile UUID: ${data.data?.profile?.id || data.user?.id}`);

    const cookieHeader = setCookie
      ? setCookie.split(',').map(c => c.split(';')[0]).join('; ')
      : '';

    // Verify /api/auth/me
    const meRes = await fetch(`${deployedUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader }
    });
    console.log(`✓ Deployed /api/auth/me status: ${meRes.status}`);
    if (meRes.ok) {
      const meData = await meRes.json();
      console.log(`  Profile Name: "${meData.data?.name}" | Role: ${meData.data?.role}`);
    }

    // Verify /api/teams
    const teamsRes = await fetch(`${deployedUrl}/api/teams`, {
      headers: { Cookie: cookieHeader }
    });
    console.log(`✓ Deployed /api/teams status: ${teamsRes.status}`);
    if (teamsRes.ok) {
      const tData = await teamsRes.json();
      console.log(`  Team Name: "${tData.data?.name}" | InviteCode: ${tData.data?.invite_code}`);
    }

    // Verify /api/auth/logout
    const logoutRes = await fetch(`${deployedUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader }
    });
    console.log(`✓ Deployed /api/auth/logout status: ${logoutRes.status}`);
    return true;
  } else {
    console.log(`Error Response:`, data);
    return false;
  }
}

async function run() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — Live Production Deployment Audit   ║');
  console.log('║   Target: https://code-e-manipal-portal.vercel.app        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  let passed = 0;
  let failed = 0;

  // Test 1: TEAM001
  const t1Ok = await testDeployedLogin(team1.loginId, team1.officialPasscode, 'TEAM001');
  if (t1Ok) passed++; else failed++;

  // Test 2: TEAM087 (Room 118)
  const t87Ok = await testDeployedLogin(team87.loginId, team87.officialPasscode, 'TEAM087 (Room 118)');
  if (t87Ok) passed++; else failed++;

  // Test 3: Hyphenated TEAM-001
  const t1HyphenOk = await testDeployedLogin(team1.canonicalIdentifier, team1.officialPasscode, 'TEAM-001 (Hyphenated)');
  if (t1HyphenOk) passed++; else failed++;

  // Test 4: Negative check
  console.log(`\n============================================================`);
  console.log(`Testing DEPLOYED PRODUCTION invalid password rejection...`);
  const negRes = await fetch(`${deployedUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': deployedUrl },
    body: JSON.stringify({ identifier: 'TEAM001', password: 'IncorrectPassword#999' }),
  });
  console.log(`Status: ${negRes.status} (Expected: 401)`);
  if (negRes.status === 401) {
    console.log('✓ Invalid credentials safely rejected with 401.');
    passed++;
  } else {
    failed++;
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`FINAL DEPLOYED PRODUCTION AUDIT: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════');
}

run();
