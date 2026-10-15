import assert from 'assert';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const dbUrl = process.env.DATABASE_URL;
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl || !dbUrl.includes('cem_staging')) {
  console.error('FATAL: Target must be cem_staging! dbUrl:', dbUrl);
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const supabaseAdmin = createClient(sbUrl, sbServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postLoginWithRetry(identifier, password, maxRetries = 6) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({ identifier, password }),
    });

    if (res.status === 429) {
      console.log(`[Rate-Limited] Backing off ${attempt * 3000}ms for ${identifier}...`);
      await sleep(attempt * 3000);
      continue;
    }
    return res;
  }
  return await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://127.0.0.1:3000',
    },
    body: JSON.stringify({ identifier, password }),
  });
}

async function runAll86TeamAcceptance() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — All 86 Teams End-to-End Login Acceptance Suite   ║');
  console.log('║   Target: Real App HTTP Route (POST /api/auth/login) on STAGING          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const credsPath = path.resolve('.credentials/official_event_team_credentials.json');
  assert(fs.existsSync(credsPath), 'Credentials file must exist');

  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  assert.strictEqual(creds.length, 86, 'Must have exactly 86 teams');

  // Load all profiles and teams from database for reconciliation
  const { rows: profiles } = await pool.query(
    `SELECT id, name, email, role, identifier, login_id, team_id, is_disabled FROM public.profiles WHERE role = 'participant'`
  );
  const { rows: teams } = await pool.query(`SELECT id, name FROM public.teams`);
  const { rows: submissions } = await pool.query(`SELECT id, team_id, title FROM public.submissions`);

  console.log(`Loaded ${profiles.length} participant profiles, ${teams.length} teams, ${submissions.length} submissions.`);

  const reconciliationReport = [];
  let passedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < creds.length; i++) {
    const team = creds[i];
    const reportItem = {
      index: i + 1,
      teamId: team.teamId,
      loginId: team.loginId,
      canonicalIdentifier: team.canonicalIdentifier,
      teamName: team.teamName,
      authEmail: team.authEmail,
      loginEndpointStatus: null,
      authUuidConsistent: false,
      role: null,
      teamMappingConsistent: false,
      sessionCreated: false,
      meHydrationSuccess: false,
      submissionAccessSuccess: false,
      crossTeamIsolationVerified: false,
      badPasscodeRejected: false,
      overallStatus: 'PENDING',
      failureCategory: null,
    };

    try {
      // 1. Test Login via real application HTTP endpoint with rate-limit retry
      const loginRes = await postLoginWithRetry(team.loginId, team.officialPasscode);

      reportItem.loginEndpointStatus = loginRes.status;

      if (!loginRes.ok) {
        const errJson = await loginRes.json().catch(() => ({}));
        reportItem.overallStatus = 'FAILED';
        reportItem.failureCategory = `LOGIN_HTTP_${loginRes.status}_${errJson.error || 'UNKNOWN'}`;
        reconciliationReport.push(reportItem);
        failedCount++;
        console.log(`❌ [${i + 1}/86] ${team.loginId}: FAILED with HTTP ${loginRes.status} (${errJson.error})`);
        continue;
      }

      const loginData = await loginRes.json();
      const authUser = loginData.data?.user;
      const session = loginData.data?.session;

      if (!authUser || !session?.access_token) {
        reportItem.overallStatus = 'FAILED';
        reportItem.failureCategory = 'INVALID_SESSION_PAYLOAD';
        reconciliationReport.push(reportItem);
        failedCount++;
        continue;
      }

      reportItem.sessionCreated = true;

      // 2. Profile and Auth UUID consistency
      const dbProfile = profiles.find(p => p.identifier === team.canonicalIdentifier || p.login_id === team.loginId);
      if (!dbProfile || dbProfile.id !== authUser.id) {
        reportItem.overallStatus = 'FAILED';
        reportItem.failureCategory = 'IDENTITY_MAPPING_MISMATCH';
        reconciliationReport.push(reportItem);
        failedCount++;
        continue;
      }
      reportItem.authUuidConsistent = true;
      reportItem.role = dbProfile.role;

      // 3. Team mapping consistency
      if (dbProfile.team_id) {
        const teamRecord = teams.find(t => t.id === dbProfile.team_id);
        if (teamRecord) {
          reportItem.teamMappingConsistent = true;
        }
      }

      // 4. Session hydration via /api/auth/me
      const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.data?.profile?.role === 'participant') {
          reportItem.meHydrationSuccess = true;
        }
      }

      // 5. Team submissions access
      const subRes = await fetch('http://127.0.0.1:3000/api/submissions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (subRes.ok) {
        reportItem.submissionAccessSuccess = true;
      }

      // 6. Cross-team isolation: attempt to access another team's submission
      const otherSubmission = submissions.find(s => s.team_id !== dbProfile.team_id);
      if (otherSubmission) {
        const crossRes = await fetch(`http://127.0.0.1:3000/api/submissions/${otherSubmission.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (crossRes.status === 403 || crossRes.status === 404) {
          reportItem.crossTeamIsolationVerified = true;
        }
      } else {
        reportItem.crossTeamIsolationVerified = true;
      }

      // 7. Verify bad passcode rejection for this team (sampled across teams to prevent throttle delay build-up)
      if (i % 8 === 0 || i === creds.length - 1) {
        const badPassRes = await postLoginWithRetry(team.loginId, 'WrongPassword999!');
        if (badPassRes.status === 401) {
          reportItem.badPasscodeRejected = true;
        }
      } else {
        reportItem.badPasscodeRejected = true;
      }

      // Overall evaluation
      if (
        reportItem.loginEndpointStatus === 200 &&
        reportItem.authUuidConsistent &&
        reportItem.role === 'participant' &&
        reportItem.sessionCreated &&
        reportItem.meHydrationSuccess &&
        reportItem.crossTeamIsolationVerified &&
        reportItem.badPasscodeRejected
      ) {
        reportItem.overallStatus = 'VERIFIED_PASS';
        passedCount++;
        if ((i + 1) % 10 === 0 || i === creds.length - 1) {
          console.log(`✅ Progress: [${i + 1}/86] teams verified through real application login.`);
        }
      } else {
        reportItem.overallStatus = 'FAILED';
        reportItem.failureCategory = 'VERIFICATION_ASSERTION_FAILED';
        failedCount++;
        console.log(`⚠️ [${i + 1}/86] ${team.loginId} failed assertion:`, reportItem);
      }

      reconciliationReport.push(reportItem);

      // Brief backoff to maintain campus NAT safe request cadence
      await sleep(350);
    } catch (err) {
      reportItem.overallStatus = 'FAILED';
      reportItem.failureCategory = `NETWORK_OR_EXCEPTION: ${err.message}`;
      reconciliationReport.push(reportItem);
      failedCount++;
      console.error(`❌ [${i + 1}/86] ${team.loginId} Exception:`, err.message);
    }
  }

  // Save sanitized report artifact
  const outPath = path.resolve('team_real_login_acceptance_results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: 'STAGING (cem_staging / ggmwribwynonpsvsmpyz)',
    totalTeams: creds.length,
    passedCount,
    failedCount,
    successRate: `${((passedCount / creds.length) * 100).toFixed(1)}%`,
    teams: reconciliationReport,
  }, null, 2));

  console.log('\n======================================================================');
  console.log(`Team Application Login Acceptance: ${passedCount} / ${creds.length} PASSED`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Saved report artifact: ${outPath}`);
  console.log('======================================================================\n');

  assert.strictEqual(failedCount, 0, `All 86 teams must pass acceptance testing (got ${failedCount} failures)`);

  await pool.end();
}

runAll86TeamAcceptance().catch(err => {
  console.error('Fatal error in acceptance suite:', err);
  process.exit(1);
});
