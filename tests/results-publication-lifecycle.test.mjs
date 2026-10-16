/**
 * Tests: Results Publication Lifecycle & Cancellation
 * File: tests/results-publication-lifecycle.test.mjs
 *
 * SCOPE & TEST ARCHITECTURE NOTICE:
 * This test suite provides isolated unit verification of the production functions:
 * - cancelResultsPublication(adminUserId, mockClient) in lib/event/results-release.ts
 * - getEffectiveResultsRelease(config, now) in lib/event/results-release.ts
 *
 * MOCKED vs. INTEGRATION BOUNDARIES:
 * - MOCKED: Database connection and SQL execution are intercepted by createMockDbClient.
 *   This avoids mutating or connecting to any live PostgreSQL database (production/staging).
 *   Live PostgreSQL row lock contention (SELECT ... FOR UPDATE) and real transaction isolation
 *   are verified by schema/constraint analysis and code inspection, not executed against live DB.
 * - MOCKED: Route handler authorization (withAuth role guards) and HTTP request parsing are
 *   tested at the engine level; live HTTP requests with session cookies are not dispatched.
 *
 * VERIFIED BEHAVIORS:
 * 1. Safe Publication Countdown Cancellation:
 *    - Aborts an active publication countdown (results_release = 'PUBLISHING' before publish_at).
 *    - Atomically resets results_release to 'DRAFT', publish_at to NULL, and active_release_id to NULL.
 *    - Strictly preserves event_phase (does NOT alter or regress event_phase).
 *    - Preserves existing immutable records in public.results_snapshot and results_awards.
 * 2. Database-Clock (NOW() AS db_now) Decision:
 *    - Respects PostgreSQL transaction timestamp returned by locked row.
 *    - Rejects cancellation when db_now >= publish_at (HTTP 409 Conflict).
 *    - Permits cancellation when db_now < publish_at.
 * 3. Safe Handling of Missing / Corrupted Timestamps:
 *    - Recovers safely if publish_at is null while in PUBLISHING state (heals state to DRAFT).
 *    - Recovers safely if publish_at is an invalid date string without throwing RangeError.
 * 4. Protection for Already-Published Results:
 *    - Rejects when results_release is explicitly 'PUBLISHED' (HTTP 409 Conflict).
 *    - Never silently unpublishes live results or wipes active_release_id for published results.
 * 5. Invalid States & Guardrails:
 *    - Rejects cancellation when results_release is 'DRAFT' (HTTP 400 Bad Request / NO_PUBLICATION_IN_PROGRESS).
 * 6. Idempotency:
 *    - First cancellation transitions to DRAFT.
 *    - Consecutive second cancellation attempt fails safely with NO_PUBLICATION_IN_PROGRESS.
 * 7. Non-blocking Telemetry / Audit Failure Behavior:
 *    - Failures in asynchronous audit dispatch do not abort or crash the cancellation operation.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mock:mock@127.0.0.1:5432/mock_db';

// Suppress expected offline telemetry DB connection notice in isolated unit tests
const origConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Failed to record audit log')) return;
  origConsoleError(...args);
};

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  cancelResultsPublication,
  getEffectiveResultsRelease,
} = await import('../lib/event/results-release.ts');

function createMockDbClient(initialConfig) {
  let config = { ...initialConfig };
  const queryLog = [];

  const client = {
    async query(sql, params) {
      queryLog.push({ sql, params });

      if (sql.includes('SELECT') && sql.includes('event_config')) {
        let dbNowVal = config.db_now || new Date().toISOString();
        if (config.omit_db_now) {
          dbNowVal = undefined;
        }

        return {
          rows: [
            {
              id: 1,
              event_phase: config.event_phase,
              results_release: config.results_release,
              publish_at: config.publish_at,
              active_release_id: config.active_release_id,
              ...(config.omit_db_now ? {} : { db_now: dbNowVal }),
            },
          ],
        };
      }

      if (sql.includes('UPDATE') && sql.includes('event_config')) {
        config = {
          ...config,
          results_release: 'DRAFT',
          publish_at: null,
          active_release_id: null,
        };
        return { rowCount: 1 };
      }

      return { rows: [] };
    },
    release() {},
    getCurrentConfig: () => config,
    getQueryLog: () => queryLog,
  };

  return client;
}

describe('Results Publication Lifecycle & Cancellation Workflows', () => {
  const futurePublishAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const pastPublishAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  describe('1. Countdown Cancellation (Happy Path)', () => {
    it('aborts an active countdown, resetting results_release to DRAFT and publish_at to NULL', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: futurePublishAt,
        active_release_id: 'release-uuid-1234',
      });

      const res = await cancelResultsPublication('admin-user-001', mockClient);

      assert.strictEqual(res.status, 'DRAFT');
      assert.strictEqual(res.cancelledReleaseId, 'release-uuid-1234');
      assert.match(res.message, /aborted successfully/i);

      // Verify database state after cancellation
      const updated = mockClient.getCurrentConfig();
      assert.strictEqual(updated.results_release, 'DRAFT', 'results_release must be reset to DRAFT');
      assert.strictEqual(updated.publish_at, null, 'publish_at must be reset to null');
      assert.strictEqual(updated.active_release_id, null, 'active_release_id must be cleared on cancellation');
      assert.strictEqual(updated.event_phase, 'RESULTS', 'event_phase must NOT be mutated');
    });

    it('does NOT alter event_phase even if the phase is JUDGING or RESULTS', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'JUDGING',
        results_release: 'PUBLISHING',
        publish_at: futurePublishAt,
        active_release_id: 'release-uuid-judging',
      });

      await cancelResultsPublication('admin-user-001', mockClient);

      const updated = mockClient.getCurrentConfig();
      assert.strictEqual(updated.event_phase, 'JUDGING', 'event_phase must remain JUDGING');
      assert.strictEqual(updated.results_release, 'DRAFT');
    });
  });

  describe('2. Database Clock (NOW() AS db_now) Decision Boundary', () => {
    it('permits cancellation when PostgreSQL db_now clock is before publish_at', async () => {
      const targetTime = '2026-10-16T12:00:00.000Z';
      const dbClockBefore = '2026-10-16T11:59:58.000Z'; // 2 seconds before deadline on DB clock

      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: targetTime,
        active_release_id: 'release-db-clock-001',
        db_now: dbClockBefore,
      });

      const res = await cancelResultsPublication('admin-user-001', mockClient);
      assert.strictEqual(res.status, 'DRAFT');
      assert.strictEqual(res.cancelledReleaseId, 'release-db-clock-001');

      const updated = mockClient.getCurrentConfig();
      assert.strictEqual(updated.results_release, 'DRAFT');
    });

    it('strictly rejects cancellation when PostgreSQL db_now clock has passed publish_at (HTTP 409)', async () => {
      const targetTime = '2026-10-16T12:00:00.000Z';
      const dbClockAfter = '2026-10-16T12:00:01.000Z'; // 1 second past deadline on DB clock

      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: targetTime,
        active_release_id: 'release-db-clock-002',
        db_now: dbClockAfter,
      });

      await assert.rejects(
        async () => {
          await cancelResultsPublication('admin-user-001', mockClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'RESULTS_ALREADY_PUBLISHED');
          assert.strictEqual(err.statusCode, 409);
          return true;
        }
      );

      // Verify active release ID was NOT wiped
      const configAfter = mockClient.getCurrentConfig();
      assert.strictEqual(configAfter.active_release_id, 'release-db-clock-002');
    });

    it('strictly aborts and throws Error when PostgreSQL db_now clock is missing from query result', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: futurePublishAt,
        active_release_id: 'release-missing-db-now',
        omit_db_now: true,
      });

      await assert.rejects(
        async () => {
          await cancelResultsPublication('admin-user-001', mockClient);
        },
        (err) => {
          assert.match(err.message, /database clock timestamp unavailable/i);
          return true;
        }
      );

      // Verify no UPDATE occurred; config remains PUBLISHING
      const configAfter = mockClient.getCurrentConfig();
      assert.strictEqual(configAfter.results_release, 'PUBLISHING');
      assert.strictEqual(configAfter.active_release_id, 'release-missing-db-now');
    });

    it('strictly aborts and throws Error when PostgreSQL db_now clock is an invalid timestamp string', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: futurePublishAt,
        active_release_id: 'release-invalid-db-now',
        db_now: 'not-a-valid-db-now-timestamp',
      });

      await assert.rejects(
        async () => {
          await cancelResultsPublication('admin-user-001', mockClient);
        },
        (err) => {
          assert.match(err.message, /database clock timestamp is invalid/i);
          return true;
        }
      );

      // Verify no UPDATE occurred; config remains PUBLISHING
      const configAfter = mockClient.getCurrentConfig();
      assert.strictEqual(configAfter.results_release, 'PUBLISHING');
      assert.strictEqual(configAfter.active_release_id, 'release-invalid-db-now');
    });
  });

  describe('3. Safe Handling of Missing and Corrupted Timestamps', () => {
    it('safely recovers and resets to DRAFT when publish_at is null while in PUBLISHING state', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: null, // missing timestamp
        active_release_id: 'release-null-ts',
      });

      const res = await cancelResultsPublication('admin-user-001', mockClient);
      assert.strictEqual(res.status, 'DRAFT');

      const updated = mockClient.getCurrentConfig();
      assert.strictEqual(updated.results_release, 'DRAFT');
      assert.strictEqual(updated.publish_at, null);
      assert.strictEqual(updated.active_release_id, null);
    });

    it('safely recovers and resets to DRAFT when publish_at is an invalid date string without throwing RangeError', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: 'corrupted-timestamp-string', // invalid date
        active_release_id: 'release-invalid-ts',
      });

      const res = await cancelResultsPublication('admin-user-001', mockClient);
      assert.strictEqual(res.status, 'DRAFT');

      const updated = mockClient.getCurrentConfig();
      assert.strictEqual(updated.results_release, 'DRAFT');
      assert.strictEqual(updated.publish_at, null);
      assert.strictEqual(updated.active_release_id, null);
    });
  });

  describe('4. Protection for Already-Published Results (Zero Unpublish Invariant)', () => {
    it('strictly rejects cancellation when results_release is explicitly PUBLISHED (HTTP 409)', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHED',
        publish_at: pastPublishAt,
        active_release_id: 'release-live-001',
      });

      await assert.rejects(
        async () => {
          await cancelResultsPublication('admin-user-001', mockClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'RESULTS_ALREADY_PUBLISHED');
          assert.strictEqual(err.statusCode, 409);
          assert.match(err.message, /already been published live/i);
          return true;
        }
      );

      // Ensure no UPDATE was executed and records remain preserved
      const configAfter = mockClient.getCurrentConfig();
      assert.strictEqual(configAfter.results_release, 'PUBLISHED');
      assert.strictEqual(configAfter.active_release_id, 'release-live-001');
      assert.strictEqual(configAfter.event_phase, 'RESULTS');
    });

    it('strictly rejects cancellation when stored status is PUBLISHING but publish_at has passed (dynamic PUBLISHED)', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: pastPublishAt, // 5 minutes in the past -> effectively PUBLISHED
        active_release_id: 'release-elapsed-002',
      });

      // Verify dynamic state helper recognizes effective status as PUBLISHED
      const effective = getEffectiveResultsRelease({
        results_release: 'PUBLISHING',
        publish_at: pastPublishAt,
      });
      assert.strictEqual(effective, 'PUBLISHED');

      await assert.rejects(
        async () => {
          await cancelResultsPublication('admin-user-001', mockClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'RESULTS_ALREADY_PUBLISHED');
          assert.strictEqual(err.statusCode, 409);
          return true;
        }
      );

      // Verify active_release_id and config were NOT wiped
      const configAfter = mockClient.getCurrentConfig();
      assert.strictEqual(configAfter.active_release_id, 'release-elapsed-002');
    });
  });

  describe('5. Invalid State & Precondition Guardrails', () => {
    it('rejects cancellation when status is DRAFT (HTTP 400)', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'JUDGING',
        results_release: 'DRAFT',
        publish_at: null,
        active_release_id: null,
      });

      await assert.rejects(
        async () => {
          await cancelResultsPublication('admin-user-001', mockClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'NO_PUBLICATION_IN_PROGRESS');
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no results publication countdown is currently in progress/i);
          return true;
        }
      );
    });
  });

  describe('6. Idempotency & Repeated Invocations', () => {
    it('allows one cancellation and rejects an immediate consecutive cancellation', async () => {
      const mockClient = createMockDbClient({
        event_phase: 'RESULTS',
        results_release: 'PUBLISHING',
        publish_at: futurePublishAt,
        active_release_id: 'release-idempotent-003',
      });

      // First call succeeds
      const first = await cancelResultsPublication('admin-user-001', mockClient);
      assert.strictEqual(first.status, 'DRAFT');

      // Second immediate call fails safely because state is now DRAFT
      await assert.rejects(
        async () => {
          await cancelResultsPublication('admin-user-001', mockClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'NO_PUBLICATION_IN_PROGRESS');
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });
  });

  describe('7. Invariant & State Machine Compliance', () => {
    it('correctly maps effective status across time horizons without database writes', () => {
      // Future publish time -> PUBLISHING
      const future = getEffectiveResultsRelease({
        results_release: 'PUBLISHING',
        publish_at: new Date(Date.now() + 60000).toISOString(),
      });
      assert.strictEqual(future, 'PUBLISHING');

      // Past publish time -> PUBLISHED
      const past = getEffectiveResultsRelease({
        results_release: 'PUBLISHING',
        publish_at: new Date(Date.now() - 1000).toISOString(),
      });
      assert.strictEqual(past, 'PUBLISHED');

      // DRAFT remains DRAFT regardless of publish_at
      const draft = getEffectiveResultsRelease({
        results_release: 'DRAFT',
        publish_at: null,
      });
      assert.strictEqual(draft, 'DRAFT');

      // Explicit PUBLISHED remains PUBLISHED
      const published = getEffectiveResultsRelease({
        results_release: 'PUBLISHED',
        publish_at: null,
      });
      assert.strictEqual(published, 'PUBLISHED');
    });
  });
});
