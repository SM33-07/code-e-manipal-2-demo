import fs from 'fs';
import path from 'path';

const teamCreds = JSON.parse(fs.readFileSync('.credentials/official_event_team_credentials.json', 'utf8'));
const team1 = teamCreds.find(t => t.teamId === 'TEAM001');
const team87 = teamCreds.find(t => t.teamId === 'TEAM087');

import xlsx from 'xlsx';
const wb = xlsx.readFile('.credentials/official_code_e_manipal_judge_credentials.xlsx');
const judgeRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const judge1 = judgeRows.find(j => j['Login ID'] === 'judge1');

const baseUrl = 'http://127.0.0.1:3000';

async function testLogin(identifier, password, label) {
  console.log(`\nTesting login for ${label} (${identifier})...`);
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': baseUrl,
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

  console.log(`  Status: ${status} ${status === 200 ? '✓ SUCCESS' : status === 401 ? '✗ 401' : 'status: ' + status}`);
  if (status === 200) {
    console.log(`  Session cookies established: ${!!setCookie}`);
    console.log(`  Role in response: ${data.data?.profile?.role || data.role}`);
    console.log(`  Profile ID: ${data.data?.profile?.id || data.user?.id}`);
    console.log(`  Team ID: ${data.data?.profile?.team_id || data.teamId}`);

    // Test authenticated /api/auth/me using returned cookies
    if (setCookie) {
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          'Cookie': setCookie.split(',').map(c => c.split(';')[0]).join('; ')
        }
      });
      console.log(`  /api/auth/me verification: ${meRes.status === 200 ? '✓ 200 OK' : 'Status ' + meRes.status}`);
      if (meRes.ok) {
        const meData = await meRes.json();
        console.log(`    Authenticated Profile: ${meData.data?.name} (${meData.data?.role})`);
      }

      // Test /api/teams
      const teamsRes = await fetch(`${baseUrl}/api/teams`, {
        headers: {
          'Cookie': setCookie.split(',').map(c => c.split(';')[0]).join('; ')
        }
      });
      console.log(`  /api/teams verification: ${teamsRes.status === 200 ? '✓ 200 OK (Clean)' : 'Status ' + teamsRes.status}`);
      if (teamsRes.ok) {
        const tData = await teamsRes.json();
        console.log(`    Team details returned: ${tData.data ? tData.data.name + ' (ID: ' + tData.data.id + ')' : 'null (no team - as expected for non-participants)'}`);
      }
    }
  } else {
    console.log(`  Error response:`, data);
  }
  return { status, data, ok: status === 200 };
}

async function run() {
  console.log('================================================================');
  console.log('  Code-e-Manipal 2.0 — End-to-End Fresh Login Acceptance Suite   ');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  // 1. Participant TEAM001 with alphanumeric loginId
  const r1 = await testLogin(team1.loginId, team1.officialPasscode, 'TEAM001 (alphanumeric)');
  if (r1.ok) passed++; else failed++;

  // 2. Participant TEAM-001 with hyphenated canonicalIdentifier
  const r2 = await testLogin(team1.canonicalIdentifier, team1.officialPasscode, 'TEAM-001 (hyphenated)');
  if (r2.ok) passed++; else failed++;

  // 3. Participant TEAM087 (Room 118)
  const r3 = await testLogin(team87.loginId, team87.officialPasscode, 'TEAM087 / Room 118');
  if (r3.ok) passed++; else failed++;

  // 4. Judge 1
  const r4 = await testLogin(judge1['Login ID'], judge1['Passcode (8-Digit)'], 'Judge 1');
  if (r4.ok) passed++; else failed++;

  // 5. Negative check: Invalid password rejected
  const r5 = await testLogin('TEAM001', 'IncorrectPass#999', 'TEAM001 with Wrong Password');
  if (r5.status === 401) {
    console.log('  ✓ Correctly rejected with 401');
    passed++;
  } else {
    console.log('  ❌ Expected 401 but got', r5.status);
    failed++;
  }

  // 6. Negative check: Unknown team rejected
  const r6 = await testLogin('TEAM999', 'SomePassword123', 'Non-existent TEAM999');
  if (r6.status === 401) {
    console.log('  ✓ Correctly rejected with 401');
    passed++;
  } else {
    console.log('  ❌ Expected 401 but got', r6.status);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
}

run();
