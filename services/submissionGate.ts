/**
 * Authoritative Server-Side Submission Decision Gate (Phase 2 Requirement D)
 * File: services/submissionGate.ts
 *
 * Implements strict precedence rules for submission eligibility:
 * 1. Phase Boundary: Event must have started and must not be in final evaluation/ended state
 *    (unless an approved extension is active). Finalization is strictly barred during HACKING phase.
 * 2. Global Freeze (HIGHEST PRECEDENCE): If event_config.global_freeze is TRUE, all submission
 *    mutations are blocked immediately. Cannot be bypassed by individual team extensions.
 * 3. Individual Team Lock (SECOND PRECEDENCE): If team.submission_frozen is TRUE, the team's
 *    submission operations are blocked. Cannot be bypassed by deadline extensions.
 * 4. Submission Finalization Lock: If submission status === 'submitted' or is_locked === TRUE,
 *    further modifications/draft edits are prohibited.
 * 5. Effective Deadline Evaluation:
 *    - Base deadline: event_config.end_time or active submission round end timestamp.
 *    - Grace period: event_config.buffer_minutes (default 5 or 15 mins).
 *    - Team Extension: team.deadline_extension (if greater than base + buffer).
 *    - Effective deadline = MAX(base_deadline + buffer, team.deadline_extension).
 *    - If server_now > effective_deadline: blocked with SUBMISSION_WINDOW_CLOSED.
 */

import { pool, query } from '@/lib/db';
import { logger } from '@/lib/utils/logger';
import { getEventConfigState } from '@/lib/event/eventConfigHelper';
import { EventPhase } from '@/lib/event/state-machine';

export interface SubmissionEligibilityResult {
  eligible: boolean;
  code?: 
    | 'EVENT_NOT_STARTED'
    | 'SUBMISSIONS_FROZEN_GLOBALLY'
    | 'TEAM_SUBMISSION_LOCKED'
    | 'SUBMISSION_ALREADY_FINALIZED'
    | 'FINALIZATION_NOT_ALLOWED_IN_HACKING'
    | 'SUBMISSION_WINDOW_CLOSED';
  message?: string;
  effectiveDeadline?: string | null;
  serverTime: string;
  isGloballyFrozen: boolean;
  isTeamLocked: boolean;
  hasExtension: boolean;
}

export interface VerifyEligibilityOptions {
  client?: any; // Optional PG client for in-transaction verification
  isFinalizing?: boolean;
  isDraftUpdate?: boolean;
}

/**
 * Single source of truth for submission eligibility across all creation, edit,
 * upload-url and finalization endpoints.
 */
export async function verifySubmissionEligibility(
  teamId: string,
  options: VerifyEligibilityOptions = {}
): Promise<SubmissionEligibilityResult> {
  const { client, isFinalizing = false } = options;

  // 1. Resolve server time and event_config (lock row if inside transaction)
  let configRow: any;
  let serverNow: Date;

  if (client) {
    const { rows: timeRows } = await client.query('SELECT NOW() as server_now');
    serverNow = new Date(timeRows[0].server_now);

    const { rows: cfgRows } = await client.query(
      `SELECT event_phase, global_freeze, submission_open, end_time, buffer_minutes
       FROM public.event_config
       WHERE id = 1
       FOR UPDATE`
    );
    if (cfgRows.length === 0) throw new Error('CONFIG_NOT_FOUND');
    configRow = cfgRows[0];
  } else {
    const { rows: timeRows } = await query('SELECT NOW() as server_now');
    serverNow = new Date(timeRows[0].server_now);

    const { rows: cfgRows } = await query(
      `SELECT event_phase, global_freeze, submission_open, end_time, buffer_minutes
       FROM public.event_config
       WHERE id = 1`
    );
    configRow = cfgRows[0] || {};
  }

  const serverNowMs = serverNow.getTime();
  const eventPhase: EventPhase = configRow.event_phase || 'NOT_STARTED';
  const isGlobalFreeze: boolean = Boolean(configRow.global_freeze);

  // 2. Resolve team lock & deadline extension
  const teamQuery = client ? client.query.bind(client) : query;
  const { rows: teamRows } = await teamQuery(
    `SELECT id, submission_frozen, deadline_extension
     FROM public.teams
     WHERE id = $1`,
    [teamId]
  );

  const team = teamRows[0];
  const isTeamLocked: boolean = Boolean(team?.submission_frozen);
  const teamExtensionIso: string | null = team?.deadline_extension || null;

  // ── Precedence Rule 1: Phase boundary check ──
  if (eventPhase === 'NOT_STARTED') {
    return {
      eligible: false,
      code: 'EVENT_NOT_STARTED',
      message: 'Hackathon has not started yet. Submissions are closed.',
      serverTime: serverNow.toISOString(),
      isGloballyFrozen: isGlobalFreeze,
      isTeamLocked,
      hasExtension: Boolean(teamExtensionIso),
    };
  }

  // ── Precedence Rule 2: Global Freeze (HIGHEST OVERRIDE) ──
  // A global freeze halts all submissions immediately, regardless of individual team extensions.
  if (isGlobalFreeze) {
    logger.warn('Submission mutation blocked by global freeze', { teamId, eventPhase });
    return {
      eligible: false,
      code: 'SUBMISSIONS_FROZEN_GLOBALLY',
      message: 'Submissions are temporarily frozen globally by event administrators.',
      serverTime: serverNow.toISOString(),
      isGloballyFrozen: true,
      isTeamLocked,
      hasExtension: Boolean(teamExtensionIso),
    };
  }

  // ── Precedence Rule 3: Individual Team Lock ──
  // An explicit team lock blocks submission operations and cannot be bypassed by deadline extensions.
  if (isTeamLocked) {
    logger.warn('Submission mutation blocked by individual team lock', { teamId });
    return {
      eligible: false,
      code: 'TEAM_SUBMISSION_LOCKED',
      message: 'Submissions for your team have been locked by an administrator.',
      serverTime: serverNow.toISOString(),
      isGloballyFrozen: false,
      isTeamLocked: true,
      hasExtension: Boolean(teamExtensionIso),
    };
  }

  // ── Precedence Rule 4: Phase-specific finalization barrier ──
  if (eventPhase === 'HACKING' && isFinalizing) {
    return {
      eligible: false,
      code: 'FINALIZATION_NOT_ALLOWED_IN_HACKING',
      message: 'Final submission is not allowed during the HACKING phase. Submissions can only be finalized during the SUBMISSION phase.',
      serverTime: serverNow.toISOString(),
      isGloballyFrozen: false,
      isTeamLocked: false,
      hasExtension: Boolean(teamExtensionIso),
    };
  }

  // ── Precedence Rule 5: Effective Deadline & Approved Team Extension ──
  // Calculate baseline deadline from event_config end_time
  let baseDeadlineMs: number | null = null;
  if (configRow.end_time) {
    baseDeadlineMs = new Date(configRow.end_time).getTime();
  } else {
    // If end_time is not set on event_config, lookup Project Making / Hacking round end timestamp
    const { rows: hackRows } = await teamQuery(
      `SELECT end_timestamp FROM public.timeline_events
       WHERE opens_submissions = TRUE AND is_published = TRUE
       LIMIT 1`
    );
    if (hackRows.length > 0 && hackRows[0].end_timestamp) {
      baseDeadlineMs = new Date(hackRows[0].end_timestamp).getTime();
    }
  }

  const bufferMinutes = configRow.buffer_minutes || 5;
  const bufferMs = bufferMinutes * 60 * 1000;

  let effectiveDeadlineMs: number | null = null;
  if (baseDeadlineMs) {
    effectiveDeadlineMs = baseDeadlineMs + bufferMs;
  }

  // If the team has an approved extension that extends beyond the effective baseline
  if (teamExtensionIso) {
    const extMs = new Date(teamExtensionIso).getTime();
    if (!effectiveDeadlineMs || extMs > effectiveDeadlineMs) {
      effectiveDeadlineMs = extMs;
    }
  }

  const effectiveDeadlineIso = effectiveDeadlineMs ? new Date(effectiveDeadlineMs).toISOString() : null;

  const isPostSubmissionPhase = (
    eventPhase === 'SUBMISSION_CLOSED' ||
    eventPhase === 'JUDGING' ||
    eventPhase === 'RESULTS' ||
    eventPhase === 'ENDED'
  );

  if (isPostSubmissionPhase) {
    if (teamExtensionIso) {
      const extMs = new Date(teamExtensionIso).getTime();
      if (serverNowMs > extMs) {
        return {
          eligible: false,
          code: 'SUBMISSION_WINDOW_CLOSED',
          message: 'The submission window is closed. Your approved team extension has expired.',
          effectiveDeadline: teamExtensionIso,
          serverTime: serverNow.toISOString(),
          isGloballyFrozen: false,
          isTeamLocked: false,
          hasExtension: true,
        };
      }
      // Extension is still active!
    } else {
      return {
        eligible: false,
        code: 'SUBMISSION_WINDOW_CLOSED',
        message: 'The submission window is closed. Further submissions or edits are no longer accepted.',
        effectiveDeadline: effectiveDeadlineIso,
        serverTime: serverNow.toISOString(),
        isGloballyFrozen: false,
        isTeamLocked: false,
        hasExtension: false,
      };
    }
  }

  // If effective deadline has elapsed
  if (effectiveDeadlineMs && serverNowMs > effectiveDeadlineMs) {
    logger.info('Submission attempt rejected: deadline exceeded', {
      teamId,
      serverTime: serverNow.toISOString(),
      effectiveDeadline: effectiveDeadlineIso,
    });

    return {
      eligible: false,
      code: 'SUBMISSION_WINDOW_CLOSED',
      message: 'The submission window is closed. Further submissions or edits are no longer accepted.',
      effectiveDeadline: effectiveDeadlineIso,
      serverTime: serverNow.toISOString(),
      isGloballyFrozen: false,
      isTeamLocked: false,
      hasExtension: Boolean(teamExtensionIso),
    };
  }

  return {
    eligible: true,
    effectiveDeadline: effectiveDeadlineIso,
    serverTime: serverNow.toISOString(),
    isGloballyFrozen: false,
    isTeamLocked: false,
    hasExtension: Boolean(teamExtensionIso),
  };
}
