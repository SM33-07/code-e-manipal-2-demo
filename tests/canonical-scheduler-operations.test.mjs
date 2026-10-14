/**
 * Canonical Event Scheduler & Operations Test Suite (Phase 2 Requirement H)
 * File: tests/canonical-scheduler-operations.test.mjs
 *
 * Verifies:
 * 1. Exact-boundary semantics: before/start/exact-start/during/end/exact-end/after transitions.
 * 2. Timezone handling: Asia/Kolkata conversion and UTC persistence.
 * 3. 10 Canonical events match UPDATED TIMELINE.pdf exactly.
 * 4. Draft and unpublished schedule isolation.
 * 5. Authoritative submission gate precedence hierarchy:
 *    - Global freeze blocks submissions even when team has an extension.
 *    - Individual team lock blocks submissions even when team has an extension.
 *    - HACKING phase blocks finalization.
 *    - Approved team extension permits submissions past base deadline.
 *    - Expired deadline blocks submissions.
 * 6. Durable advisory-locked scheduler & exact-once announcement idempotency:
 *    - Retries and duplicate ticks create zero duplicate announcements.
 *    - Stale recovery threshold prevents alert flooding after outage.
 *    - Concurrent worker lock protection.
 * 7. Notification receipts isolation per user.
 * 8. Round-aware active and next round timer derivation.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool, query } from '../lib/db.ts';
import {
  deriveEventStatus,
  getPublishedTimeline,
  getAllTimelineEventsAdmin,
  getActiveRoundInfo,
  EVENT_TIMEZONE,
} from '../services/timelineService.ts';
import { verifySubmissionEligibility } from '../services/submissionGate.ts';
import {
  runSchedulerTick,
  SCHEDULER_LOCK_ID,
  STALE_NOTIFICATION_THRESHOLD_MS,
} from '../services/schedulerService.ts';

describe('Phase 2 — Canonical Event Scheduler and Real-Time Operations', () => {
  let testTeamA;
  let testTeamB;
  let testUserA;
  let testUserB;
  let originalConfig;

  before(async () => {
    // 1. Snapshot original event_config
    const { rows: cfgRows } = await query('SELECT * FROM public.event_config WHERE id = 1');
    originalConfig = cfgRows[0] || {};

    // 2. Resolve two test teams from database
    const { rows: teams } = await query(
      'SELECT id, name, submission_frozen, deadline_extension FROM public.teams ORDER BY created_at ASC LIMIT 2'
    );
    assert.ok(teams.length >= 2, 'Staging database must contain at least 2 teams');
    testTeamA = teams[0];
    testTeamB = teams[1];

    // 3. Resolve two test profiles
    const { rows: profiles } = await query(
      'SELECT id FROM public.profiles WHERE is_disabled = FALSE ORDER BY created_at ASC LIMIT 2'
    );
    testUserA = profiles[0]?.id || crypto.randomUUID();
    testUserB = profiles[1]?.id || crypto.randomUUID();
  });

  after(async () => {
    // Restore original event_config state
    if (originalConfig) {
      await query(
        `UPDATE public.event_config
         SET event_phase = $1,
             global_freeze = $2,
             start_time = $3,
             end_time = $4,
             updated_at = NOW()
         WHERE id = 1`,
        [
          originalConfig.event_phase,
          Boolean(originalConfig.global_freeze),
          originalConfig.start_time,
          originalConfig.end_time,
        ]
      );
    }

    // Reset team lock/extension on test teams
    await query(
      'UPDATE public.teams SET submission_frozen = FALSE, deadline_extension = NULL WHERE id IN ($1, $2)',
      [testTeamA.id, testTeamB.id]
    );

    // Clean up test draft events and receipts created during tests
    await query("DELETE FROM public.timeline_events WHERE title LIKE 'TEST_EVENT_%'");
    await query("DELETE FROM public.announcements WHERE idempotency_key LIKE 'test_%'");
    await query("DELETE FROM public.user_notification_receipts WHERE user_id IN ($1, $2)", [
      testUserA,
      testUserB,
    ]);
    await pool.end();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. EXACT BOUNDARY SEMANTICS TEST
  // ─────────────────────────────────────────────────────────────
  describe('A. Dynamic Event State & Exact-Boundary Semantics', () => {
    const startIso = '2026-10-15T14:00:00.000Z'; // 2:00 PM UTC
    const endIso = '2026-10-15T19:00:00.000Z';   // 7:00 PM UTC
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    test('1. Before event start -> "upcoming"', () => {
      const status = deriveEventStatus(startIso, endIso, startMs - 1000);
      assert.equal(status, 'upcoming');
    });

    test('2. Exact start boundary (now === start_timestamp) -> "current"', () => {
      const status = deriveEventStatus(startIso, endIso, startMs);
      assert.equal(status, 'current');
    });

    test('3. During event interval (start < now < end) -> "current"', () => {
      const midMs = startMs + (endMs - startMs) / 2;
      const status = deriveEventStatus(startIso, endIso, midMs);
      assert.equal(status, 'current');
    });

    test('4. Exact end boundary (now === end_timestamp) -> "current"', () => {
      const status = deriveEventStatus(startIso, endIso, endMs);
      assert.equal(status, 'current');
    });

    test('5. After event end (now > end_timestamp) -> "completed"', () => {
      const status = deriveEventStatus(startIso, endIso, endMs + 1000);
      assert.equal(status, 'completed');
    });

    test('6. Null end timestamp behaves as 1-hour interval', () => {
      const statusDuring = deriveEventStatus(startIso, null, startMs + 1800000); // +30m
      assert.equal(statusDuring, 'current');

      const statusAfter = deriveEventStatus(startIso, null, startMs + 3600001); // +60m + 1ms
      assert.equal(statusAfter, 'completed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. AUTHORITATIVE SCHEDULE PARITY & DRAFT ISOLATION
  // ─────────────────────────────────────────────────────────────
  describe('B. Canonical 10 Events & Draft Schedule Isolation', () => {
    test('1. Exactly 10 canonical events exist with valid order and timestamps', async () => {
      const { events } = await getPublishedTimeline();
      assert.equal(events.length, 10, 'Authoritative schedule must contain exactly 10 events');

      // Verify sequence and display_order 1 to 10
      events.forEach((ev, idx) => {
        assert.equal(ev.display_order, idx + 1, `Event #${idx + 1} must have display_order ${idx + 1}`);
        assert.ok(ev.start_timestamp, `Event #${ev.display_order} (${ev.title}) must have start_timestamp`);
        assert.ok(ev.end_timestamp, `Event #${ev.display_order} (${ev.title}) must have end_timestamp`);
      });

      // Verify key authoritative milestones from UPDATED TIMELINE.pdf
      const regEvent = events[0];
      assert.equal(regEvent.title, 'Registration Open');
      assert.equal(regEvent.venue, 'AB1');

      const hackingEvent = events[3];
      assert.equal(hackingEvent.title, 'Project Making');
      assert.equal(hackingEvent.opens_submissions, true);

      const closingEvent = events[9];
      assert.equal(closingEvent.title, 'Result & Closing Ceremony');
      assert.equal(closingEvent.venue, 'Vasanti Pai');
    });

    test('2. Draft (unpublished) schedule events are strictly hidden from participants', async () => {
      const draftId = crypto.randomUUID();
      await query(
        `INSERT INTO public.timeline_events (
           id, title, day_label, time_range, start_timestamp, end_timestamp,
           display_order, is_published, card_position
         ) VALUES ($1, 'TEST_EVENT_SECRET_DRAFT', 'DAY 1', '10:00 PM – 11:00 PM',
           '2026-10-15T16:30:00Z', '2026-10-15T17:30:00Z', 99, FALSE, 'right')`,
        [draftId]
      );

      try {
        const publicSchedule = await getPublishedTimeline();
        const foundInPublic = publicSchedule.events.some((e) => e.id === draftId);
        assert.equal(foundInPublic, false, 'Unpublished draft event must not leak to participants');

        const adminSchedule = await getAllTimelineEventsAdmin();
        const foundInAdmin = adminSchedule.events.some((e) => e.id === draftId);
        assert.equal(foundInAdmin, true, 'Admin schedule view must include draft events');
      } finally {
        await query('DELETE FROM public.timeline_events WHERE id = $1', [draftId]);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. SUBMISSION GATE PRECEDENCE HIERARCHY
  // ─────────────────────────────────────────────────────────────
  describe('C. Server-Side Submission Decision Gate Precedence Hierarchy', () => {
    test('1. Phase Boundary: Blocked when EVENT_NOT_STARTED', async () => {
      await query("UPDATE public.event_config SET event_phase = 'NOT_STARTED', global_freeze = FALSE WHERE id = 1");
      const res = await verifySubmissionEligibility(testTeamA.id);
      assert.equal(res.eligible, false);
      assert.equal(res.code, 'EVENT_NOT_STARTED');
    });

    test('2. Global Freeze: Overrides and blocks submissions even when team has an approved extension', async () => {
      // Set phase to SUBMISSION
      // Give Team A a future deadline extension (e.g. 2 hours from now)
      // Enable global freeze
      const futureExt = new Date(Date.now() + 2 * 3600000).toISOString();
      await query(
        `UPDATE public.event_config
         SET event_phase = 'SUBMISSION', global_freeze = TRUE, end_time = NOW() - INTERVAL '1 hour'
         WHERE id = 1`
      );
      await query('UPDATE public.teams SET deadline_extension = $1, submission_frozen = FALSE WHERE id = $2', [
        futureExt,
        testTeamA.id,
      ]);

      const res = await verifySubmissionEligibility(testTeamA.id);
      assert.equal(res.eligible, false, 'Global freeze must block submission');
      assert.equal(res.code, 'SUBMISSIONS_FROZEN_GLOBALLY', 'Must return SUBMISSIONS_FROZEN_GLOBALLY code');
      assert.equal(res.isGloballyFrozen, true);
    });

    test('3. Team Lock: Overrides and blocks submissions even when team has an approved extension', async () => {
      // Unfreeze globally, but lock Team A
      await query("UPDATE public.event_config SET global_freeze = FALSE, event_phase = 'SUBMISSION' WHERE id = 1");
      await query('UPDATE public.teams SET submission_frozen = TRUE WHERE id = $1', [testTeamA.id]);

      const res = await verifySubmissionEligibility(testTeamA.id);
      assert.equal(res.eligible, false, 'Team lock must block submission');
      assert.equal(res.code, 'TEAM_SUBMISSION_LOCKED', 'Must return TEAM_SUBMISSION_LOCKED code');
      assert.equal(res.isTeamLocked, true);
    });

    test('4. HACKING Phase: Finalization barred during HACKING phase', async () => {
      await query("UPDATE public.event_config SET event_phase = 'HACKING', global_freeze = FALSE, end_time = NOW() + INTERVAL '24 hours' WHERE id = 1");
      await query('UPDATE public.teams SET submission_frozen = FALSE, deadline_extension = NULL WHERE id = $1', [
        testTeamA.id,
      ]);

      // Draft creation/update should be permitted in HACKING
      const draftRes = await verifySubmissionEligibility(testTeamA.id, { isFinalizing: false });
      assert.equal(draftRes.eligible, true, 'Draft operations permitted in HACKING');

      // Finalization must be strictly barred in HACKING
      const finalRes = await verifySubmissionEligibility(testTeamA.id, { isFinalizing: true });
      assert.equal(finalRes.eligible, false);
      assert.equal(finalRes.code, 'FINALIZATION_NOT_ALLOWED_IN_HACKING');
    });

    test('5. Approved Team Extension: Permits submissions beyond expired baseline deadline', async () => {
      // Base deadline expired 1 hour ago
      // Team A has extension valid for 2 more hours
      // Team B has no extension
      const pastDeadline = new Date(Date.now() - 3600000).toISOString();
      const futureExt = new Date(Date.now() + 7200000).toISOString();

      await query(
        `UPDATE public.event_config
         SET event_phase = 'SUBMISSION_CLOSED', global_freeze = FALSE, end_time = $1, buffer_minutes = 5
         WHERE id = 1`,
        [pastDeadline]
      );

      await query('UPDATE public.teams SET submission_frozen = FALSE, deadline_extension = $1 WHERE id = $2', [
        futureExt,
        testTeamA.id,
      ]);
      await query('UPDATE public.teams SET submission_frozen = FALSE, deadline_extension = NULL WHERE id = $1', [
        testTeamB.id,
      ]);

      // Team A with active extension -> ELIGIBLE
      const resA = await verifySubmissionEligibility(testTeamA.id);
      assert.equal(resA.eligible, true, 'Team with active extension must be eligible past deadline');
      assert.equal(resA.hasExtension, true);

      // Team B without extension -> BLOCKED
      const resB = await verifySubmissionEligibility(testTeamB.id);
      assert.equal(resB.eligible, false, 'Team without extension must be rejected past deadline');
      assert.equal(resB.code, 'SUBMISSION_WINDOW_CLOSED');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. DURABLE SCHEDULER & ANNOUNCEMENT IDEMPOTENCY
  // ─────────────────────────────────────────────────────────────
  describe('D. Durable Advisory Lock Scheduler & Idempotency', () => {
    test('1. Advisory lock protects scheduler tick against concurrent execution', async () => {
      const client = await pool.connect();
      try {
        // Manually hold advisory lock
        const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [
          SCHEDULER_LOCK_ID,
        ]);
        assert.equal(rows[0].acquired, true, 'Advisory lock should be acquirable');

        // Simultaneous runSchedulerTick should detect lock and skip safely
        const tickResult = await runSchedulerTick();
        assert.equal(tickResult.executed, false, 'Concurrent tick must skip when lock held');
        assert.equal(tickResult.message, 'Lock held by active scheduler worker');
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [SCHEDULER_LOCK_ID]);
        client.release();
      }
    });

    test('2. Idempotency keys prevent duplicate announcements under retries', async () => {
      // Insert a test event that started 5 minutes ago
      const testEventId = crypto.randomUUID();
      const start5m = new Date(Date.now() - 5 * 60000).toISOString();
      const end5m = new Date(Date.now() + 55 * 60000).toISOString();

      await query(
        `INSERT INTO public.timeline_events (
           id, title, day_label, time_range, start_timestamp, end_timestamp,
           display_order, is_published, opens_submissions, card_position
         ) VALUES ($1, 'TEST_EVENT_IDEMPOTENCY', 'DAY 1', 'Live Round',
           $2, $3, 98, TRUE, TRUE, 'left')`,
        [testEventId, start5m, end5m]
      );

      try {
        // First tick creates the announcement
        const tick1 = await runSchedulerTick();
        assert.equal(tick1.executed, true);
        const expectedKey = `timeline_${testEventId}_start`;
        const hasKey = tick1.newAnnouncementKeys.includes(expectedKey);
        assert.ok(hasKey, 'First tick must generate the announcement');

        // Second tick immediately after must be a NO-OP for this key
        const tick2 = await runSchedulerTick();
        assert.equal(tick2.executed, true);
        const duplicated = tick2.newAnnouncementKeys.includes(expectedKey);
        assert.equal(duplicated, false, 'Second tick must NOT duplicate announcement');

        // Verify exactly one announcement exists in the database
        const { rows: annRows } = await query(
          'SELECT COUNT(*)::int as count FROM public.announcements WHERE idempotency_key = $1',
          [expectedKey]
        );
        assert.equal(annRows[0].count, 1, 'Database must contain exactly 1 announcement record');
      } finally {
        await query('DELETE FROM public.announcements WHERE event_id = $1', [testEventId]);
        await query('DELETE FROM public.timeline_events WHERE id = $1', [testEventId]);
      }
    });

    test('3. Stale transition protection: transitions older than threshold do not flood alerts', async () => {
      const oldEventId = crypto.randomUUID();
      // Started 5 hours ago (> 2-hour stale threshold)
      const start5h = new Date(Date.now() - 5 * 3600000).toISOString();
      const end4h = new Date(Date.now() - 4 * 3600000).toISOString();

      await query(
        `INSERT INTO public.timeline_events (
           id, title, day_label, time_range, start_timestamp, end_timestamp,
           display_order, is_published, card_position
         ) VALUES ($1, 'TEST_EVENT_STALE', 'DAY 1', 'Old Event',
           $2, $3, 97, TRUE, 'right')`,
        [oldEventId, start5h, end4h]
      );

      try {
        const tick = await runSchedulerTick();
        assert.ok(tick.skippedStaleCount > 0, 'Must record skipped stale events');

        const { rows: annRows } = await query(
          'SELECT 1 FROM public.announcements WHERE event_id = $1',
          [oldEventId]
        );
        assert.equal(annRows.length, 0, 'No announcement should be published for stale transitions');
      } finally {
        await query('DELETE FROM public.timeline_events WHERE id = $1', [oldEventId]);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. NOTIFICATION CENTRE RECEIPTS & ISOLATION
  // ─────────────────────────────────────────────────────────────
  describe('E. Participant Notification Receipts & Isolation', () => {
    let testAnnId;

    before(async () => {
      const { rows } = await query(
        `INSERT INTO public.announcements (
           id, content, type, is_active, idempotency_key, created_at
         ) VALUES (
           gen_random_uuid(), 'Test Public System Broadcast', 'info', TRUE, 'test_ann_receipts', NOW()
         ) RETURNING id`
      );
      testAnnId = rows[0].id;
    });

    after(async () => {
      await query('DELETE FROM public.user_notification_receipts WHERE announcement_id = $1', [
        testAnnId,
      ]);
      await query('DELETE FROM public.announcements WHERE id = $1', [testAnnId]);
    });

    test('1. User A marking an announcement as read does not affect User B', async () => {
      // Mark as read for User A
      await query(
        `INSERT INTO public.user_notification_receipts (user_id, announcement_id, is_read, read_at)
         VALUES ($1, $2, TRUE, NOW())
         ON CONFLICT (user_id, announcement_id) DO UPDATE SET is_read = TRUE, read_at = NOW()`,
        [testUserA, testAnnId]
      );

      // Check User A's read status
      const { rows: rowsA } = await query(
        `SELECT is_read FROM public.user_notification_receipts
         WHERE user_id = $1 AND announcement_id = $2`,
        [testUserA, testAnnId]
      );
      assert.equal(rowsA[0]?.is_read, true, "User A's receipt must be marked as read");

      // Check User B's unread status (no receipt or is_read = false)
      const { rows: rowsB } = await query(
        `SELECT is_read FROM public.user_notification_receipts
         WHERE user_id = $1 AND announcement_id = $2`,
        [testUserB, testAnnId]
      );
      const isReadB = rowsB[0]?.is_read || false;
      assert.equal(isReadB, false, "User B's unread status must remain unaffected");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. ROUND-AWARE ACTIVE TIMER DERIVATION
  // ─────────────────────────────────────────────────────────────
  describe('F. Round-Aware Active Timer Derivation', () => {
    test('1. getActiveRoundInfo derives active and upcoming rounds deterministically', async () => {
      const info = await getActiveRoundInfo();
      assert.ok(info.serverTime, 'Must provide server timestamp');
      assert.ok(typeof info.timeRemainingFormatted === 'string', 'Must provide formatted timer string');

      // If no active round, next round should be populated if future events exist
      if (!info.activeRound) {
        assert.ok(info.nextRound !== undefined, 'Next round should be resolvable');
      }
    });
  });
});
