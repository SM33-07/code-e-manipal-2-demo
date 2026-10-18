/**
 * Test Suite: Public Read-Only Demo Mode Security, Safety & Isolation Verification
 * File: tests/public-demo-mode-security.test.mjs
 *
 * Verifies:
 * 1. Fail-closed production safety guard: Fatal error if production credentials/endpoints are detected.
 * 2. Complete mutation rejection: POST, PUT, PATCH, DELETE are blocked server-side in demo mode.
 * 3. Unauthenticated mutation endpoint blocking (login, forgot-password, setup-password, session, cron, register).
 * 4. Data isolation: Zero real participant credentials, emails, or tokens are exposed.
 * 5. Public browsing availability via synthetic fixtures (35 challenges, leaderboard, timeline, showcase).
 * 6. Fail-safe configuration handling (synthetic mode fallback when isolated DB is unconfigured).
 * 7. Production invariance: Existing behavior remains unchanged when demo mode is disabled.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';

import {
  isDemoMode,
  assertDemoModeSafety,
  getDemoDataSourceMode,
  ProductionSafetyError,
  PROHIBITED_PRODUCTION_PATTERNS,
} from '../lib/demo/demoMode.ts';
import {
  DEMO_EVENT_CONFIG,
  DEMO_RANKED_RESULTS,
  getSyntheticDemoProblemStatements,
  getDemoTimeline,
  getDemoSubmission,
} from '../lib/demo/demoFixtures.ts';
import { withAuth } from '../lib/middleware/withAuth.ts';
import { withGuardedAuth } from '../lib/auth/guards.ts';
import { getPublicEventConfig } from '../lib/event/eventConfigHelper.ts';
import { getPublicProblemStatements, getPublicProblemStatementBySlugOrId } from '../services/problemStatementService.ts';
import { getPublishedTimeline } from '../services/timelineService.ts';
import { getPublicNavigation } from '../lib/navigation/portal.ts';

import { POST as loginPost } from '../app/api/auth/login/route.ts';
import { POST as forgotPasswordPost } from '../app/api/auth/forgot-password/route.ts';
import { POST as setupPasswordPost } from '../app/api/auth/setup-password/route.ts';
import { POST as updatePasswordPost } from '../app/api/auth/update-password/route.ts';
import { POST as sessionPost } from '../app/api/auth/session/route.ts';
import { POST as logoutPost } from '../app/api/auth/logout/route.ts';
import { GET as callbackGet } from '../app/api/auth/callback/route.ts';
import { POST as cronPost, GET as cronGet } from '../app/api/cron/scheduler/route.ts';
import { POST as registerPost } from '../app/api/register/route.ts';
import { GET as submissionByIdGet } from '../app/api/submissions/[id]/route.ts';
import { GET as publicResultsGet } from '../app/api/results/public/route.ts';

// Save original environment
const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

describe('Gate 1: Fail-Closed Production Safety Guard', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('assertDemoModeSafety() throws ProductionSafetyError when DATABASE_URL targets production Azure PostgreSQL', () => {
    process.env.DEMO_MODE = 'true';
    process.env.DATABASE_URL = 'postgres://ManipalPortal2026:secret@code-e-manipal-db.postgres.database.azure.com:5432/postgres?sslmode=require';

    assert.throws(
      () => assertDemoModeSafety(),
      (err) => {
        assert(err instanceof ProductionSafetyError, 'Must throw ProductionSafetyError');
        assert(err.message.includes('code-e-manipal-db'), 'Must mention production database');
        return true;
      }
    );
  });

  test('assertDemoModeSafety() throws ProductionSafetyError when SUPABASE_URL targets production Supabase project', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_URL = 'https://ihnclawnbtkwvbfqwxfe.supabase.co';

    assert.throws(
      () => assertDemoModeSafety(),
      (err) => {
        assert(err instanceof ProductionSafetyError, 'Must throw ProductionSafetyError');
        assert(err.message.includes('ihnclawnbtkwvbfqwxfe'), 'Must mention production Supabase');
        return true;
      }
    );
  });

  test('assertDemoModeSafety() throws ProductionSafetyError when NEXT_PUBLIC_SUPABASE_URL targets production Supabase project', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ihnclawnbtkwvbfqwxfe.supabase.co';

    assert.throws(
      () => assertDemoModeSafety(),
      (err) => {
        assert(err instanceof ProductionSafetyError, 'Must throw ProductionSafetyError');
        assert(err.message.includes('ihnclawnbtkwvbfqwxfe'), 'Must mention production Supabase');
        return true;
      }
    );
  });

  test('assertDemoModeSafety() succeeds when demo mode is active with isolated or synthetic configuration', () => {
    process.env.DEMO_MODE = 'true';
    process.env.DATABASE_URL = 'postgres://demo_user:safe_demo@localhost:5432/cem_demo_isolated';
    process.env.SUPABASE_URL = 'https://demo-project-isolated.supabase.co';

    assert.doesNotThrow(() => assertDemoModeSafety());
  });

  test('assertDemoModeSafety() does not throw in non-demo mode even if production URLs exist in environment', () => {
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.DATABASE_URL = 'postgres://ManipalPortal2026:secret@code-e-manipal-db.postgres.database.azure.com:5432/postgres';

    assert.doesNotThrow(() => assertDemoModeSafety());
  });
});

describe('Gate 2: Mutation Blocking at Server Middleware Layer', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('withAuth strictly blocks POST requests with 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    let handlerInvoked = false;
    const protectedHandler = withAuth(async () => {
      handlerInvoked = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const req = new NextRequest('http://localhost:3000/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ title: 'Malicious Attempt' }),
    });

    const res = await protectedHandler(req);
    assert.equal(res.status, 403, 'Must return 403 Forbidden');
    assert.equal(handlerInvoked, false, 'Handler must never be reached');

    const json = await res.json();
    assert.match(json.error, /Demo Mode Active/i, 'Must inform user that mutations are disabled in demo mode');
  });

  test('withAuth strictly blocks PUT, PATCH, and DELETE requests with 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      let handlerInvoked = false;
      const protectedHandler = withAuth(async () => {
        handlerInvoked = true;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const req = new NextRequest('http://localhost:3000/api/submissions/sub-123', {
        method,
        headers: { 'Origin': 'http://localhost:3000' },
      });

      const res = await protectedHandler(req);
      assert.equal(res.status, 403, `${method} must return 403 Forbidden`);
      assert.equal(handlerInvoked, false, `${method} handler must never be invoked`);
    }
  });

  test('withGuardedAuth strictly blocks state-changing requests with 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    let handlerInvoked = false;
    const guardedHandler = withGuardedAuth(async () => {
      handlerInvoked = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const req = new NextRequest('http://localhost:3000/api/judging/reviews', {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:3000' },
      body: JSON.stringify({ score: 100 }),
    });

    const res = await guardedHandler(req);
    assert.equal(res.status, 403, 'Must return 403 Forbidden');
    assert.equal(handlerInvoked, false, 'Guarded handler must never be reached');
  });
});

describe('Gate 3: Unauthenticated Mutation Endpoints Blocking', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('POST /api/auth/login returns 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
      body: JSON.stringify({ identifier: 'TEAM001', password: 'Password123!' }),
    });

    const res = await loginPost(req);
    assert.equal(res.status, 403, 'Must reject login with 403 Forbidden');
    const json = await res.json();
    assert.match(json.error, /Demo Mode Active/i);
  });

  test('POST /api/auth/forgot-password returns 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const res = await forgotPasswordPost(req);
    assert.equal(res.status, 403, 'Must reject password reset with 403 Forbidden');
  });

  test('POST /api/auth/setup-password returns 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/auth/setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    });

    const res = await setupPasswordPost(req);
    assert.equal(res.status, 403, 'Must reject password setup with 403');
  });

  test('POST /api/auth/session returns 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
      body: JSON.stringify({ access_token: 'fake', refresh_token: 'fake' }),
    });

    const res = await sessionPost(req);
    assert.equal(res.status, 403, 'Must reject session exchange with 403');
  });

  test('POST /api/auth/update-password returns 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NewSecurePassword123!' }),
    });

    const res = await updatePasswordPost(req);
    assert.equal(res.status, 403, 'Must reject password update with 403 Forbidden');
  });

  test('POST /api/auth/logout clears session cookies safely in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const res = await logoutPost(req);
    assert.equal(res.status, 200, 'Must return 200 OK');
    const cookieHeader = res.headers.get('set-cookie') || '';
    assert.match(cookieHeader, /cem_session_id=/);
  });

  test('GET /api/auth/callback redirects to /login?notice=demo_mode in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/auth/callback?code=fake-oauth-code', {
      method: 'GET',
    });

    const res = await callbackGet(req);
    assert.equal(res.status, 307, 'Must redirect');
    assert.match(res.headers.get('location') || '', /notice=demo_mode/);
  });

  test('POST /api/cron/scheduler returns 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/cron/scheduler', {
      method: 'POST',
    });

    const res = await cronPost(req);
    assert.equal(res.status, 403, 'Must reject mutation POST to cron with 403 Forbidden');
  });

  test('GET /api/cron/scheduler reports disabled in demo mode without mutating state', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/cron/scheduler', {
      method: 'GET',
    });

    const res = await cronGet(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data?.status, 'disabled_in_demo_mode');
  });

  test('POST /api/register returns 403 Forbidden in demo mode', async () => {
    process.env.DEMO_MODE = 'true';

    const res = await registerPost();
    assert.equal(res.status, 403, 'Must return 403 in demo mode');
  });
});

describe('Gate 4: Public Browsing via Synthetic Demo Fixtures', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('getPublicEventConfig() returns DEMO_EVENT_CONFIG with published results status', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;

    const config = await getPublicEventConfig();
    assert.equal(config.event_phase, 'RESULTS');
    assert.equal(config.results_release, 'PUBLISHED');
    assert.equal(config.problem_statements_published, true);
    assert.equal(config.is_submission_open, false);
    assert.equal(config.submission_window_status, 'CLOSED_BY_DEADLINE');
    assert(config.announcements.length > 0, 'Must provide announcements');
  });

  test('getPublicProblemStatements() returns all 35 verified challenge briefs across 9 tracks', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;

    const result = await getPublicProblemStatements();
    assert.equal(result.isPublished, true);
    assert.equal(result.statements.length, 35, 'Must contain exactly 35 problem statements');
    assert.equal(result.tracks.length, 9, 'Must span all 9 competition tracks');

    // Verify first challenge brief has required fields
    const ps01 = result.statements.find((s) => s.id === 'PS 01');
    assert(ps01, 'PS 01 must exist');
    assert(ps01.title.includes('ArcSense'), 'Must have correct title');
    assert(ps01.problem_statement.length > 50, 'Must have detailed problem statement');
    assert(ps01.deliverables.length > 20, 'Must have deliverables');
  });

  test('getPublicProblemStatementBySlugOrId() resolves challenge brief by slug', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;

    const detail = await getPublicProblemStatementBySlugOrId('ps-01-arcsense-early-warning-for-unstable-weld-signatures');
    assert(detail, 'Should resolve PS 01 by slug');
    assert.equal(detail.statement.id, 'PS 01');
    assert.equal(detail.statement.challenge_num, 1);
  });

  test('getDemoTimeline() returns 10 canonical published schedule events matching event PDF', () => {
    const timeline = getDemoTimeline();
    assert.equal(timeline.config.is_published, true);
    assert.equal(timeline.events.length, 10, 'Must have 10 canonical schedule items matching tests/timeline-management');

    const phases = new Set(timeline.events.map((e) => e.day_label));
    assert(phases.has('DAY 1'), 'Must include DAY 1');
    assert(phases.has('DAY 2'), 'Must include DAY 2');
    assert.equal(timeline.events[0].title, 'Registration Open');
    assert.equal(timeline.events[0].venue, 'AB1');
    assert.equal(timeline.events[1].title, 'Opening Ceremony');
    assert.equal(timeline.events[1].venue, 'Vasanti Pai');
  });

  test('DEMO_RANKED_RESULTS contains 10 sanitized showcase teams with no real emails or credentials', () => {
    assert.equal(DEMO_RANKED_RESULTS.length, 10, 'Must have 10 ranked teams');

    for (const team of DEMO_RANKED_RESULTS) {
      assert(team.team_name.startsWith('Team '), 'Team names must be sanitized');
      assert.equal(typeof team.computed.total_score, 'number');
      assert.equal(typeof team.computed.rank, 'number');
      // Ensure zero emails or credentials in the object
      assert.equal(team.email, undefined, 'No email must be exposed');
      assert.equal(team.password, undefined, 'No password must be exposed');
    }

    // Verify Rank 1 is NeuralPulse
    assert.equal(DEMO_RANKED_RESULTS[0].computed.rank, 1);
    assert.equal(DEMO_RANKED_RESULTS[0].team_name, 'Team NeuralPulse');
  });

  test('GET /api/submissions/[id] returns public showcase project for demo project ID 1', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/submissions/1', {
      method: 'GET',
    });

    const res = await submissionByIdGet(req, { params: Promise.resolve({ id: '1' }) });
    assert.equal(res.status, 200, 'Must return 200 for demo project 1');
    const json = await res.json();
    assert.equal(json.data?.id, '1');
    assert(json.data?.title.includes('EcoTrack'));
    assert.equal(json.data?.teams?.name, 'Green Coders');
  });

  test('GET /api/results/public returns DEMO_RANKED_RESULTS with is_demo: true and disclaimer', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;

    const req = new NextRequest('http://localhost:3000/api/results/public', {
      method: 'GET',
    });

    const res = await publicResultsGet(req);
    assert.equal(res.status, 200, 'Must return 200 OK');
    const json = await res.json();
    assert.equal(json.data.length, 10, 'Must return 10 ranked demo teams');
    assert.equal(json.meta?.is_demo, true, 'Must indicate is_demo in meta');
    assert(json.meta?.disclaimer, 'Must include disclaimer in meta');
  });

  test('getPublicNavigation() includes Results and Guidelines without Gallery in demo mode', () => {
    process.env.DEMO_MODE = 'true';

    const items = getPublicNavigation();
    const links = items.map((i) => i.link);
    assert(links.includes('/problem-statements'), 'Must include problem statements');
    assert(links.includes('/timeline'), 'Must include timeline');
    assert(!links.includes('/gallery'), 'Must NOT include gallery in demo mode');
    assert(links.includes('/results'), 'Must include results in demo mode');
    assert(links.includes('/guidelines'), 'Must include guidelines in demo mode');
  });
});

describe('Gate 5: Configuration Resilience & Fail-Safe Fallbacks', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('getDemoDataSourceMode() returns synthetic when DATABASE_URL is not configured', () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DATABASE_URL;

    assert.equal(getDemoDataSourceMode(), 'synthetic');
  });

  test('getDemoDataSourceMode() selects synthetic data even if an inherited database URL exists', () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DEMO_DATA_SOURCE;
    process.env.DATABASE_URL = 'postgres://demouser:demopass@localhost:5432/inherited_db';

    assert.equal(getDemoDataSourceMode(), 'synthetic');
  });

  test('getDemoDataSourceMode() returns isolated_db when DEMO_DATA_SOURCE=isolated_db is explicitly configured', () => {
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_DATA_SOURCE = 'isolated_db';
    process.env.DATABASE_URL = 'postgres://demouser:demopass@localhost:5432/cem_demo_db';

    assert.equal(getDemoDataSourceMode(), 'isolated_db');
  });

  test('getDemoDataSourceMode() rejects unsafe production DATABASE_URL rather than silently bypassing it', () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DEMO_DATA_SOURCE;
    process.env.DATABASE_URL = 'postgres://admin:secret@code-e-manipal-db.postgres.database.azure.com:5432/prod_db';

    assert.throws(() => getDemoDataSourceMode(), (err) => {
      return err.name === 'ProductionSafetyError';
    });
  });
});

describe('Gate 6: Production Invariance When Demo Mode is Disabled', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('isDemoMode() returns false when DEMO_MODE and NEXT_PUBLIC_DEMO_MODE are unset', () => {
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;

    assert.equal(isDemoMode(), false);
  });

  test('getPublicNavigation() returns standard 4 items in production mode', () => {
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;

    const items = getPublicNavigation();
    assert.equal(items.length, 4, 'Production public nav must only have Home, Problem Statements, Timeline, FAQ');
    const links = items.map((i) => i.link);
    assert(!links.includes('/gallery'), 'Production public nav does not include gallery');
    assert(!links.includes('/results'), 'Production public nav does not include results');
  });
});
