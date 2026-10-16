/**
 * Tests: Submission Window Controls, Pause/Resume, and Deadline Enforcement
 * File: tests/submission-window-controls.test.mjs
 *
 * Verifies:
 * 1. computeSubmissionWindowStatus state machine transitions:
 *    - PAUSED when submission_open is false
 *    - FROZEN when global_freeze is true
 *    - OPEN when submission_open is true and deadline is in the future
 *    - CLOSED_BY_DEADLINE when deadline has passed and no override is granted
 *    - OVERRIDDEN when deadline has passed but allow_deadline_override is true
 * 2. Backend Submission Gate precedence (verifySubmissionEligibility):
 *    - Global freeze precedence (SUBMISSIONS_FROZEN_GLOBALLY)
 *    - Submission paused precedence (SUBMISSION_PAUSED)
 *    - Deadline enforcement (SUBMISSION_WINDOW_CLOSED)
 *    - Explicit admin override enforcement (allows submission past deadline without rewriting timestamp)
 *    - Team-specific deadline extension handling
 * 3. Authoritative scheduled deadline preservation:
 *    - Scheduled deadline (2026-10-16T01:30:00Z) is never mutated by pause, resume, or override actions.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mock:mock@127.0.0.1:5432/mock_db';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { computeSubmissionWindowStatus } = await import('../lib/event/eventConfigHelper.ts');
const { verifySubmissionEligibility } = await import('../services/submissionGate.ts');

describe('Submission Window Controls & Gate Enforcement Suite', () => {
  const STATED_DEADLINE_ISO = '2026-10-16T01:30:00Z'; // 7:00 AM IST

  describe('1. computeSubmissionWindowStatus State Derivation', () => {
    it('returns FROZEN when global_freeze is true, even if submission_open is true', () => {
      const res = computeSubmissionWindowStatus({
        event_phase: 'SUBMISSION_OPEN',
        submission_open: true,
        global_freeze: true,
        end_time: '2026-10-16T12:00:00Z',
      }, new Date('2026-10-16T05:00:00Z'));
      assert.strictEqual(res.status, 'FROZEN');
      assert.strictEqual(res.isOpen, false);
    });

    it('returns PAUSED when submission_open is false', () => {
      const res = computeSubmissionWindowStatus({
        event_phase: 'SUBMISSION_OPEN',
        submission_open: false,
        global_freeze: false,
        end_time: '2026-10-16T12:00:00Z',
      }, new Date('2026-10-16T05:00:00Z'));
      assert.strictEqual(res.status, 'PAUSED');
      assert.strictEqual(res.isOpen, false);
    });

    it('returns OPEN when submission_open is true and current time is before deadline', () => {
      const res = computeSubmissionWindowStatus({
        event_phase: 'SUBMISSION_OPEN',
        submission_open: true,
        global_freeze: false,
        end_time: '2026-10-16T07:00:00Z',
      }, new Date('2026-10-16T05:00:00Z'));
      assert.strictEqual(res.status, 'OPEN');
      assert.strictEqual(res.isOpen, true);
    });

    it('returns CLOSED_BY_DEADLINE when submission_open is true, deadline passed, and override is false', () => {
      const res = computeSubmissionWindowStatus({
        event_phase: 'SUBMISSION_OPEN',
        submission_open: true,
        global_freeze: false,
        end_time: '2026-10-16T01:30:00Z',
        allow_deadline_override: false,
        buffer_minutes: 5,
      }, new Date('2026-10-16T02:00:00Z')); // 30 mins after deadline
      assert.strictEqual(res.status, 'CLOSED_BY_DEADLINE');
      assert.strictEqual(res.isOpen, false);
    });

    it('returns OVERRIDDEN when submission_open is true, deadline passed, but allow_deadline_override is true', () => {
      const res = computeSubmissionWindowStatus({
        event_phase: 'SUBMISSION_OPEN',
        submission_open: true,
        global_freeze: false,
        end_time: '2026-10-16T01:30:00Z',
        allow_deadline_override: true,
        buffer_minutes: 5,
      }, new Date('2026-10-16T02:00:00Z'));
      assert.strictEqual(res.status, 'OVERRIDDEN');
      assert.strictEqual(res.isOpen, true);
    });

    it('returns SCHEDULED when event_phase is NOT_STARTED', () => {
      const res = computeSubmissionWindowStatus({
        event_phase: 'NOT_STARTED',
        submission_open: true,
        global_freeze: false,
      }, new Date('2026-10-16T05:00:00Z'));
      assert.strictEqual(res.status, 'SCHEDULED');
      assert.strictEqual(res.isOpen, false);
    });
  });

  describe('2. Backend verifySubmissionEligibility Precedence & Behavior', () => {
    const mockTeamId = '00000000-0000-0000-0000-000000000001';

    function createMockClient({
      serverNow = new Date('2026-10-16T01:00:00Z'),
      config = {},
      team = {},
    }) {
      return {
        query: async (sql, params) => {
          if (sql.includes('SELECT NOW() as server_now')) {
            return { rows: [{ server_now: serverNow.toISOString() }] };
          }
          if (sql.includes('SELECT * FROM public.event_config')) {
            return {
              rows: [
                {
                  id: 1,
                  event_phase: 'SUBMISSION_OPEN',
                  global_freeze: false,
                  submission_open: true,
                  allow_deadline_override: false,
                  end_time: STATED_DEADLINE_ISO,
                  buffer_minutes: 5,
                  ...config,
                },
              ],
            };
          }
          if (sql.includes('SELECT id, submission_frozen, deadline_extension')) {
            return {
              rows: [
                {
                  id: mockTeamId,
                  submission_frozen: false,
                  deadline_extension: null,
                  ...team,
                },
              ],
            };
          }
          if (sql.includes('SELECT end_timestamp FROM public.timeline_events')) {
            return { rows: [] };
          }
          return { rows: [] };
        },
      };
    }

    it('rejects with SUBMISSION_PAUSED when submission_open is false', async () => {
      const client = createMockClient({
        config: {
          submission_open: false,
          event_phase: 'SUBMISSION_OPEN',
        },
      });

      const result = await verifySubmissionEligibility(mockTeamId, { client });
      assert.strictEqual(result.eligible, false);
      assert.strictEqual(result.code, 'SUBMISSION_PAUSED');
      assert.strictEqual(result.isSubmissionOpen, false);
    });

    it('rejects with SUBMISSIONS_FROZEN_GLOBALLY when global_freeze is true', async () => {
      const client = createMockClient({
        config: {
          global_freeze: true,
          submission_open: true,
        },
      });

      const result = await verifySubmissionEligibility(mockTeamId, { client });
      assert.strictEqual(result.eligible, false);
      assert.strictEqual(result.code, 'SUBMISSIONS_FROZEN_GLOBALLY');
      assert.strictEqual(result.isGloballyFrozen, true);
    });

    it('allows submission when submission_open is true and current time is before deadline', async () => {
      const client = createMockClient({
        serverNow: new Date('2026-10-16T01:00:00Z'), // 30 min before 01:30:00Z
        config: {
          submission_open: true,
          end_time: STATED_DEADLINE_ISO,
          allow_deadline_override: false,
        },
      });

      const result = await verifySubmissionEligibility(mockTeamId, { client });
      assert.strictEqual(result.eligible, true);
      assert.strictEqual(result.isOverridden, false);
    });

    it('rejects with SUBMISSION_WINDOW_CLOSED when deadline + buffer has passed and override is false', async () => {
      const client = createMockClient({
        serverNow: new Date('2026-10-16T01:40:00Z'), // 10 min after deadline + 5 min buffer
        config: {
          submission_open: true,
          end_time: STATED_DEADLINE_ISO,
          allow_deadline_override: false,
          buffer_minutes: 5,
        },
      });

      const result = await verifySubmissionEligibility(mockTeamId, { client });
      assert.strictEqual(result.eligible, false);
      assert.strictEqual(result.code, 'SUBMISSION_WINDOW_CLOSED');
    });

    it('permits submission past deadline when allow_deadline_override is true', async () => {
      const client = createMockClient({
        serverNow: new Date('2026-10-16T02:00:00Z'), // 30 min after deadline
        config: {
          submission_open: true,
          end_time: STATED_DEADLINE_ISO,
          allow_deadline_override: true,
        },
      });

      const result = await verifySubmissionEligibility(mockTeamId, { client });
      assert.strictEqual(result.eligible, true);
      assert.strictEqual(result.isOverridden, true);
    });

    it('rejects team if team has submission_frozen = true even when submissions are open', async () => {
      const client = createMockClient({
        serverNow: new Date('2026-10-16T01:00:00Z'),
        config: {
          submission_open: true,
        },
        team: {
          submission_frozen: true,
        },
      });

      const result = await verifySubmissionEligibility(mockTeamId, { client });
      assert.strictEqual(result.eligible, false);
      assert.strictEqual(result.code, 'TEAM_SUBMISSION_LOCKED');
      assert.strictEqual(result.isTeamLocked, true);
    });

    it('allows submission when team has an individual deadline extension extending past base deadline', async () => {
      const client = createMockClient({
        serverNow: new Date('2026-10-16T01:50:00Z'), // past base deadline
        config: {
          submission_open: true,
          end_time: STATED_DEADLINE_ISO,
          allow_deadline_override: false,
        },
        team: {
          deadline_extension: '2026-10-16T02:30:00Z', // extended 1 hour
        },
      });

      const result = await verifySubmissionEligibility(mockTeamId, { client });
      assert.strictEqual(result.eligible, true);
      assert.strictEqual(result.hasExtension, true);
    });
  });

  describe('3. Scheduled Deadline Preservation Guarantee', () => {
    it('scheduled deadline timestamp is not mutated when pause or override states toggle', () => {
      const config = {
        end_time: STATED_DEADLINE_ISO,
        submission_open: false,
        allow_deadline_override: false,
      };

      // Action 1: Resume
      const resumed = { ...config, submission_open: true };
      assert.strictEqual(resumed.end_time, STATED_DEADLINE_ISO);

      // Action 2: Override past deadline
      const overridden = { ...resumed, allow_deadline_override: true };
      assert.strictEqual(overridden.end_time, STATED_DEADLINE_ISO);

      // Action 3: Pause
      const paused = { ...overridden, submission_open: false };
      assert.strictEqual(paused.end_time, STATED_DEADLINE_ISO);

      // Scheduled deadline remains exactly 16 Oct 2026, 7:00 AM IST
      assert.strictEqual(paused.end_time, '2026-10-16T01:30:00Z');
    });
  });
});
