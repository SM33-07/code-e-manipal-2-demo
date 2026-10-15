import fs from 'fs';
import path from 'path';
import pg from 'pg';
import xlsx from 'xlsx';

const baseUrl = 'http://127.0.0.1:3000';

// Read .env.local
const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    let val = v.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[k.trim()] = val;
  }
});

const parsedDb = new URL(env.DATABASE_URL);
const parsedSb = new URL(env.SUPABASE_URL);

console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║   Code-e-Manipal 2.0 — Permanent Judge Accounts & Judging Verification   ║');
console.log(`║   Target DB:       ${parsedDb.hostname.padEnd(53)}║`);
console.log(`║   Target Database: ${parsedDb.pathname.padEnd(53)}║`);
console.log(`║   Target Supabase: ${parsedSb.hostname.padEnd(53)}║`);
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

// Target safety check
if (!parsedDb.hostname.includes('code-e-manipal-db.postgres.database.azure.com') || !parsedDb.pathname.includes('postgres')) {
  console.error('❌ Safety Guardrail: Target database must be production "postgres" on Azure.');
  process.exit(1);
}
if (!parsedSb.hostname.includes('ihnclawnbtkwvbfqwxfe')) {
  console.error('❌ Safety Guardrail: Target Supabase project must be production "ihnclawnbtkwvbfqwxfe".');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Load Credential Registry
const xlsxPath = path.resolve('.credentials/official_code_e_manipal_judge_credentials.xlsx');
const wb = xlsx.readFile(xlsxPath);
const judgeRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

if (judgeRows.length !== 5) {
  console.error(`❌ Expected exactly 5 judges in operational roster, found ${judgeRows.length}`);
  process.exit(1);
}

const teamPath = path.resolve('.credentials/official_event_team_credentials.json');
const teams = JSON.parse(fs.readFileSync(teamPath, 'utf8'));
const sampleTeam = teams.find(t => t.teamId === 'TEAM088') || teams[0];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

async function run() {
  const pgClient = await pool.connect();
  try {
    // ── Phase 1: Database & Registry Inventory Inspection ───────────────────
    console.log('Phase 1: Verifying Database Profiles & Operational Roster...');
    
    const { rows: dbProfiles } = await pgClient.query(`
      SELECT id, name, email, role, login_id, identifier, is_disabled
      FROM public.profiles
      WHERE role = 'judge'
      ORDER BY login_id
    `);

    assert(dbProfiles.length >= 5, `Database contains at least 5 judge profiles (found ${dbProfiles.length})`);

    for (const j of judgeRows) {
      const loginId = j['Login ID'];
      const badgeId = j['Badge / Canonical ID'];
      const email = j['System Email'];
      const passcode = j['Passcode (8-Digit)'];
      const designation = j['Designation'];

      // Check passcode format: exactly 8 alphanumeric characters
      const validPasscode = typeof passcode === 'string' && passcode.length === 8 && /^[a-zA-Z0-9]{8}$/.test(passcode);
      assert(validPasscode, `Judge ${loginId} has valid 8-char alphanumeric passcode`);

      // Match profile in database
      const profile = dbProfiles.find(p => p.login_id?.toUpperCase() === loginId.toUpperCase());
      assert(!!profile, `Profile exists in public.profiles for ${loginId} (${designation})`);
      if (profile) {
        assert(profile.identifier === badgeId, `Identifier matches badge ${badgeId} for ${loginId}`);
        assert(profile.email.toLowerCase() === email.toLowerCase(), `Email matches ${email} for ${loginId}`);
        assert(profile.role === 'judge', `Role is 'judge' for ${loginId}`);
        assert(!profile.is_disabled, `Account is active (not disabled) for ${loginId}`);
      }
    }

    // ── Phase 2: Authentication & Session Lifecycle for All 5 Judges ────────
    console.log('\nPhase 2: Verifying Live Authentication for All 5 Judges...');

    for (const j of judgeRows) {
      const loginId = j['Login ID'];
      const badgeId = j['Badge / Canonical ID'];
      const passcode = j['Passcode (8-Digit)'];
      const designation = j['Designation'];

      console.log(`\n--- Testing ${designation} Judge: ${loginId} (${badgeId}) ---`);

      // 1. Login with Login ID
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseUrl },
        body: JSON.stringify({ identifier: loginId, password: passcode }),
      });
      assert(loginRes.status === 200, `Login with loginId '${loginId}' returns HTTP 200 OK`);

      const rawCookies = typeof loginRes.headers.getSetCookie === 'function'
        ? loginRes.headers.getSetCookie()
        : (loginRes.headers.get('set-cookie') ? [loginRes.headers.get('set-cookie')] : []);
      const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');

      let loginData = {};
      try { loginData = await loginRes.json(); } catch {}
      const token = loginData.data?.session?.access_token;
      assert(!!token, `Session token generated for ${loginId}`);

      // 2. Verify /api/auth/me with Cookie
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieHeader },
      });
      assert(meRes.status === 200, `/api/auth/me returns HTTP 200 OK`);
      let meData = {};
      try { meData = await meRes.json(); } catch {}
      assert(meData.data?.profile?.role === 'judge', `Authenticated role is 'judge'`);
      assert(meData.data?.profile?.login_id === loginId, `Authenticated login_id matches '${loginId}'`);
      assert(meData.data?.profile?.identifier === badgeId, `Authenticated identifier matches '${badgeId}'`);

      // 3. Verify /api/judging/assignments accessibility
      const assignRes = await fetch(`${baseUrl}/api/judging/assignments`, {
        headers: { Cookie: cookieHeader },
      });
      assert(assignRes.status === 200, `GET /api/judging/assignments accessible (HTTP 200)`);

      // 4. Verify canonical identifier login (e.g. JUDGE-02)
      const canonRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseUrl },
        body: JSON.stringify({ identifier: badgeId, password: passcode }),
      });
      assert(canonRes.status === 200, `Login with canonical identifier '${badgeId}' returns HTTP 200 OK`);

      // 5. Logout
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: cookieHeader, Origin: baseUrl },
      });
      assert(logoutRes.status === 200, `POST /api/auth/logout terminates session cleanly (HTTP 200)`);

      // 6. Post-logout verification on protected route
      const postLogoutMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieHeader },
      });
      assert(postLogoutMe.status === 401, `Session invalidated after logout (HTTP 401)`);
    }

    // ── Phase 3: Negative Authentication Tests ──────────────────────────────
    console.log('\nPhase 3: Running Negative Authentication Tests...');
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ identifier: 'judge1', password: 'InvalidPassword#123' }),
    });
    assert(wrongPassRes.status === 401, `Incorrect passcode rejected with HTTP 401`);

    const unknownJudgeRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ identifier: 'judge99', password: 'ArbitraryPassword#123' }),
    });
    assert(unknownJudgeRes.status === 401, `Unknown judge identifier rejected with HTTP 401`);

    // ── Phase 4: Role Boundaries & Authorization Checks ─────────────────────
    console.log('\nPhase 4: Testing Strict Role Boundaries & Security Enforcements...');

    // A. Participant attempting judge routes
    console.log(`- Testing Participant (${sampleTeam.teamId}) attempting judge routes...`);
    const partLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ identifier: sampleTeam.loginId, password: sampleTeam.officialPasscode }),
    });
    const partCookies = typeof partLogin.headers.getSetCookie === 'function'
      ? partLogin.headers.getSetCookie()
      : (partLogin.headers.get('set-cookie') ? [partLogin.headers.get('set-cookie')] : []);
    const partCookieHeader = partCookies.map(c => c.split(';')[0]).join('; ');

    const partJudgeAssign = await fetch(`${baseUrl}/api/judging/assignments`, {
      headers: { Cookie: partCookieHeader },
    });
    assert(partJudgeAssign.status === 403, `Participant blocked from GET /api/judging/assignments with HTTP 403`);

    const partJudgeReview = await fetch(`${baseUrl}/api/judging/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: partCookieHeader, Origin: baseUrl },
      body: JSON.stringify({ submission_id: '00000000-0000-0000-0000-000000000000' }),
    });
    assert(partJudgeReview.status === 403, `Participant blocked from POST /api/judging/reviews with HTTP 403`);

    // B. Judge attempting admin routes
    console.log(`- Testing Judge (judge1) attempting admin routes...`);
    const j1 = judgeRows[0];
    const j1Login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ identifier: j1['Login ID'], password: j1['Passcode (8-Digit)'] }),
    });
    const j1Cookies = typeof j1Login.headers.getSetCookie === 'function'
      ? j1Login.headers.getSetCookie()
      : (j1Login.headers.get('set-cookie') ? [j1Login.headers.get('set-cookie')] : []);
    const j1CookieHeader = j1Cookies.map(c => c.split(';')[0]).join('; ');

    const jAdminUsers = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: j1CookieHeader },
    });
    assert(jAdminUsers.status === 403, `Judge blocked from GET /api/admin/users with HTTP 403`);

    const jAdminAssign = await fetch(`${baseUrl}/api/admin/assignments`, {
      headers: { Cookie: j1CookieHeader },
    });
    assert(jAdminAssign.status === 403, `Judge blocked from GET /api/admin/assignments with HTTP 403`);

    const jAdminAudit = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Cookie: j1CookieHeader },
    });
    assert(jAdminAudit.status === 403, `Judge blocked from GET /api/admin/audit-logs with HTTP 403`);

    // ── Phase 5: Live Judging Validation & Persistence Engine Checks ────────
    console.log('\nPhase 5: Verifying Judging Submission Validation Rules & Engine...');

    // 1. Validation Rule: Phase gate check (when phase is NOT_STARTED)
    const mockSubmissionId = 'dbbe662e-5eed-496d-a157-3a52d41de949';
    const phaseGateRes = await fetch(`${baseUrl}/api/judging/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: j1CookieHeader, Origin: baseUrl },
      body: JSON.stringify({
        submission_id: mockSubmissionId,
        score_innovation: 8,
        score_technical: 8,
        score_presentation: 8,
        score_impact: 8,
        expected_version: 0,
        is_complete: true,
      }),
    });
    assert(phaseGateRes.status === 403, `Score submission blocked when judging phase closed (HTTP 403)`);

    // 2. Validation Rule: Invalid score bounds (< 1 or > 10)
    const invalidScoreRes = await fetch(`${baseUrl}/api/judging/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: j1CookieHeader, Origin: baseUrl },
      body: JSON.stringify({
        submission_id: mockSubmissionId,
        score_innovation: 15, // Out of bounds
        expected_version: 0,
      }),
    });
    assert(invalidScoreRes.status === 400 || invalidScoreRes.status === 403, `Invalid score value rejected (HTTP ${invalidScoreRes.status})`);

    // 3. Validation Rule: Missing expected_version
    const missingVerRes = await fetch(`${baseUrl}/api/judging/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: j1CookieHeader, Origin: baseUrl },
      body: JSON.stringify({
        submission_id: mockSubmissionId,
        score_innovation: 8,
      }),
    });
    assert(missingVerRes.status === 400, `Missing expected_version rejected with HTTP 400`);

    // 4. Validation Rule: Invalid submission UUID
    const badUuidRes = await fetch(`${baseUrl}/api/judging/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: j1CookieHeader, Origin: baseUrl },
      body: JSON.stringify({
        submission_id: 'non-uuid-string',
        expected_version: 0,
      }),
    });
    assert(badUuidRes.status === 400, `Malformed submission_id rejected with HTTP 400`);

    // ── Phase 6: Verify Real Data Integrity ─────────────────────────────────
    console.log('\nPhase 6: Verifying Preservation of Real Production Data...');

    const { rows: postReviews } = await pgClient.query('SELECT COUNT(*)::int as cnt FROM public.judge_reviews');
    assert(postReviews[0].cnt === 2, `Existing judge_reviews table preserved untouched (exactly 2 rows)`);

    const { rows: postAssignments } = await pgClient.query('SELECT COUNT(*)::int as cnt FROM public.judge_assignments');
    assert(postAssignments[0].cnt === 1, `Existing judge_assignments preserved untouched (exactly 1 row)`);

    const { rows: postConfig } = await pgClient.query('SELECT event_phase FROM public.event_config WHERE id = 1');
    assert(postConfig[0].event_phase === 'NOT_STARTED', `Event phase confirmed NOT_STARTED (unmutated)`);

    console.log('\n================================================================');
    console.log(`ACCEPTANCE SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('================================================================\n');

    if (failed > 0) {
      throw new Error(`Acceptance suite had ${failed} failure(s).`);
    }

    console.log('🎉 ALL PERMANENT JUDGE ACCOUNTS & JUDGING WORKFLOW CHECKS PASSED!');

  } finally {
    pgClient.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('\n❌ FATAL TEST FAILURE:', err.message);
  process.exit(1);
});
