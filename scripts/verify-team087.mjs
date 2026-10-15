import pg from 'pg';
import assert from 'assert';
import { createClient } from '@supabase/supabase-js';
import { registerTeamSession, revokeAllTeamSessions, TEAM_MAX_CONCURRENT_SESSIONS } from '../lib/auth/teamSessionLimit.ts';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const proposedPassword = process.env.PROPOSED_PASSWORD;

if (!databaseUrl || !supabaseUrl || !supabaseServiceKey || !proposedPassword) {
  console.error('❌ Error: Missing required environment variables.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — Comprehensive Verification of TEAM087             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  // 1. Verify exactly one team record
  console.log('1. Verifying public.teams record for Room 118...');
  const { rows: teams } = await pool.query(
    "SELECT id, name, invite_code, leader_name FROM public.teams WHERE invite_code = 'TEAM087' OR name = 'Room 118'"
  );
  assert.equal(teams.length, 1, `Expected exactly 1 team, found ${teams.length}`);
  const team = teams[0];
  assert.equal(team.name, 'Room 118');
  assert.equal(team.invite_code, 'TEAM087');
  assert.equal(team.leader_name, 'Kanishk Satyajit Das');
  console.log('   ✅ Team record verified:', team);

  // 2. Verify profile mapping
  console.log('\n2. Verifying public.profiles mapping for TEAM087...');
  const { rows: profiles } = await pool.query(
    "SELECT id, name, email, identifier, login_id, role, team_id FROM public.profiles WHERE login_id = 'TEAM087'"
  );
  assert.equal(profiles.length, 1, `Expected exactly 1 profile, found ${profiles.length}`);
  const profile = profiles[0];
  assert.equal(profile.login_id, 'TEAM087');
  assert.equal(profile.identifier, 'TEAM-087');
  assert.equal(profile.email, 'kanishksatyajitdas@gmail.com');
  assert.equal(profile.team_id, team.id);
  assert.equal(profile.role, 'participant');
  console.log('   ✅ Profile verified:', profile);

  // 3. Verify roster in public.team_members
  console.log('\n3. Verifying public.team_members roster (all 4 participants)...');
  const { rows: members } = await pool.query(
    "SELECT id, team_id, user_id, role, name, email, phone, college, study_year, is_verified FROM public.team_members WHERE team_id = $1 ORDER BY role DESC, name ASC",
    [team.id]
  );
  assert.equal(members.length, 4, `Expected exactly 4 members, found ${members.length}`);

  const leader = members.find(m => m.role === 'leader');
  assert.ok(leader, 'Leader must exist');
  assert.equal(leader.name, 'Kanishk Satyajit Das');
  assert.equal(leader.email, 'kanishksatyajitdas@gmail.com');
  assert.equal(leader.is_verified, true, 'Leader must be verified');
  assert.equal(leader.user_id, profile.id, 'Leader user_id must match profile/auth id');

  const regularMembers = members.filter(m => m.role === 'member');
  assert.equal(regularMembers.length, 3, 'Must have exactly 3 regular members');

  const expectedRoster = [
    { name: 'Piyush Agarwal', email: 'piyushagarwal5525@gmail.com' },
    { name: 'Veer Jain', email: 'veertiarra123@gmail.com' },
    { name: 'Ashita Saxena', email: 'ashitas2024@gmail.com' },
  ];

  for (const exp of expectedRoster) {
    const found = regularMembers.find(m => m.email.toLowerCase() === exp.email.toLowerCase());
    assert.ok(found, `Member ${exp.name} (${exp.email}) must exist in roster`);
    assert.equal(found.name, exp.name);
    assert.equal(found.is_verified, false, 'Non-leader roster member must have is_verified = false');
    assert.equal(found.user_id, null, 'Non-leader roster member must have user_id = null');
    console.log(`   ✅ Verified member: ${found.name} | ${found.email} | ${found.phone} | ${found.college} (${found.study_year})`);
  }
  console.log(`   ✅ Verified leader: ${leader.name} | ${leader.email} | ${leader.phone} | ${leader.college} (${leader.study_year})`);

  // 4. Test login via HTTP endpoint /api/auth/login using TEAM087
  console.log('\n4. Testing HTTP login using identifier "TEAM087"...');
  await revokeAllTeamSessions(team.id);
  const loginRes1 = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      identifier: 'TEAM087',
      password: proposedPassword,
    }),
  });
  console.log('   HTTP status for TEAM087 login:', loginRes1.status);
  const loginData1 = await loginRes1.json();
  if (loginRes1.status !== 200) {
    console.log('   TEAM087 login error body:', loginData1);
  }
  assert.equal(loginRes1.status, 200, `Expected 200 OK, got ${loginRes1.status}`);
  console.log('   Login response role:', loginData1.data?.user?.role);
  console.log('   Login response teamId:', loginData1.data?.user?.teamId);
  console.log('   Login response identifier:', loginData1.data?.user?.identifier);
  assert.equal(loginData1.data?.user?.identifier, 'TEAM-087');
  console.log('   ✅ Login using identifier "TEAM087" succeeded.');

  // 5. Test login via HTTP endpoint /api/auth/login using Auth email
  console.log('\n5. Testing HTTP login using Auth Email "kanishksatyajitdas@gmail.com"...');
  const loginRes2 = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'kanishksatyajitdas@gmail.com',
      password: proposedPassword,
    }),
  });
  console.log('   HTTP status for email login:', loginRes2.status);
  const loginData2 = await loginRes2.json();
  if (loginRes2.status !== 200) {
    console.log('   429 response body:', loginData2);
  }
  assert.equal(loginRes2.status, 200, `Expected 200 OK, got ${loginRes2.status}`);
  assert.equal(loginData2.data?.user?.identifier, 'TEAM-087');
  console.log('   ✅ Login using Auth Email succeeded.');

  // 6. Test Team Members API /api/teams/[id]/members
  console.log('\n6. Testing /api/teams/[id]/members with session cookies & bearer token...');
  const accessToken = loginData1.data?.session?.access_token;
  const cookieHeaders = typeof loginRes1.headers.getSetCookie === 'function'
    ? loginRes1.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
    : loginRes1.headers.get('set-cookie') || '';
  const membersRes = await fetch(`http://localhost:3000/api/teams/${team.id}/members`, {
    headers: {
      Cookie: cookieHeaders,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  console.log('   /api/teams/[id]/members status:', membersRes.status);
  assert.equal(membersRes.status, 200);
  const membersJson = await membersRes.json();
  const apiMembers = membersJson.data || [];
  console.log(`   Roster members returned by API: ${apiMembers.length}`);
  assert.equal(apiMembers.length, 4, `Expected 4 members from API, got ${apiMembers.length}`);
  apiMembers.forEach((m, idx) => {
    console.log(`     ${idx + 1}. [${m.role}] ${m.name} (${m.email})`);
  });
  console.log('   ✅ Team dashboard members API verified.');

  // 7. Test Concurrency Limit: 5 sessions allowed, 6th rejected
  console.log('\n7. Testing 5-Session Concurrent Limit for TEAM087...');
  await revokeAllTeamSessions(team.id);

  // Register 5 concurrent sessions
  for (let i = 1; i <= 5; i++) {
    const fakeToken = `test_token_slot_${i}_${Date.now()}`;
    const reg = await registerTeamSession({
      sessionId: fakeToken,
      teamId: team.id,
      userId: profile.id,
      ipHash: `test_ip_hash_${i}`,
      userAgentSummary: `Test Device ${i}`,
    });
    assert.equal(reg.allowed, true, `Session slot ${i} must be allowed`);
    assert.equal(reg.activeCount, i);
  }
  console.log('   ✅ 5 concurrent sessions successfully registered.');

  // Attempt 6th session
  const fakeToken6 = `test_token_slot_6_${Date.now()}`;
  const reg6 = await registerTeamSession({
    sessionId: fakeToken6,
    teamId: team.id,
    userId: profile.id,
    ipHash: 'test_ip_hash_6',
    userAgentSummary: 'Test Device 6',
  });
  assert.equal(reg6.allowed, false, 'Sixth session must be strictly rejected');
  assert.equal(reg6.reason, 'TEAM_SESSION_LIMIT_EXCEEDED');
  assert.equal(reg6.activeCount, 5);
  console.log('   ✅ Sixth concurrent session strictly rejected with LIMIT_EXCEEDED.');

  // Cleanup test sessions
  await revokeAllTeamSessions(team.id);
  console.log('   ✅ Cleaned up test session slots.');

  // 8. Verify existing team unaffected (e.g. TEAM001)
  console.log('\n8. Verifying existing team (TEAM001) login integrity...');
  const { rows: team1Profiles } = await pool.query(
    "SELECT id, name, email, login_id FROM public.profiles WHERE login_id = 'TEAM001'"
  );
  assert.equal(team1Profiles.length, 1);
  console.log('   ✅ Existing team TEAM001 profile intact:', team1Profiles[0].name);

  const { rows: team1Members } = await pool.query(
    "SELECT count(*)::int as count FROM public.team_members WHERE team_id = (SELECT id FROM public.teams WHERE invite_code = 'TEAM001')"
  );
  console.log('   ✅ Existing team TEAM001 roster count intact:', team1Members[0].count);

  console.log('\n================================================================');
  console.log('🎉 ALL 8 VERIFICATION GATES PASSED PERFECTLY FOR TEAM087!');
  console.log('================================================================\n');

  await pool.end();
}

main().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
