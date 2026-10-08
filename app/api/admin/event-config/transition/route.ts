import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import { logAudit } from '@/lib/auth/telemetry';
import {
  isValidPhase,
  isLegalTransition,
  requireJudgingComplete,
  LEGAL_TRANSITIONS,
  EventPhase,
} from '@/lib/event/state-machine';
import { getPublicEventConfig } from '@/lib/event/eventConfigHelper';

/**
 * PATCH /api/admin/event-config/transition
 * (also accepts POST)
 *
 * Admin only — advances the hackathon phase strictly along the sequential graph:
 * NOT_STARTED → HACKING → SUBMISSION → SUBMISSION_CLOSED → JUDGING → RESULTS → ENDED
 *
 * Invariants:
 * 1. Non-sequential transitions rejected with 400 Bad Request.
 * 2. JUDGING → RESULTS strictly blocked until requireJudgingComplete() passes.
 * 3. Protected against TOCTOU via SELECT ... FOR UPDATE.
 * 4. Retries on serialization conflict (40001) / deadlock (40P01).
 */
async function handleTransition(req: NextRequest, { user }: { user: any }) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid request body.');
  }

  const { target_phase } = body;

  if (!target_phase || !isValidPhase(target_phase)) {
    return Errors.BAD_REQUEST(
      `Invalid target_phase. Must be one of: NOT_STARTED, HACKING, SUBMISSION, SUBMISSION_CLOSED, JUDGING, RESULTS, ENDED.`
    );
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

      // 1. Acquire row-level lock on event_config
      const { rows } = await client.query(
        'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return Errors.NOT_FOUND('Event configuration not found.');
      }

      const currentPhase: EventPhase = rows[0].event_phase;

      // 2. Validate sequential transition legality
      if (!isLegalTransition(currentPhase, target_phase)) {
        await client.query('ROLLBACK');
        const legalNext = LEGAL_TRANSITIONS[currentPhase];
        return Errors.BAD_REQUEST(
          `Illegal phase transition from ${currentPhase} to ${target_phase}. Legal next phase is: ${legalNext || 'NONE (Terminal state)'}.`
        );
      }

      // 3. Special gate: JUDGING → RESULTS requires complete evaluations
      if (target_phase === 'RESULTS') {
        try {
          await requireJudgingComplete();
        } catch (gateErr: any) {
          await client.query('ROLLBACK');
          logger.warn('Judging completion gate blocked transition to RESULTS', {
            reasons: gateErr.details?.reasons,
          });
          return Errors.BAD_REQUEST(
            gateErr.message,
            gateErr.details
          );
        }
      }

      // 4. Execute atomic phase transition
      await client.query(
        `UPDATE public.event_config SET
           event_phase = $1,
           updated_at = NOW()
         WHERE id = 1`,
        [target_phase]
      );

      // Side-effect: Archive stale submission announcements when starting hackathon
      if (target_phase === 'HACKING') {
        const closeMsg = '⏰ Submissions are now closed! Thank you for participating. Teams with approved extensions may still submit.';
        await client.query(
          `UPDATE public.announcements SET is_active = FALSE WHERE content = $1`,
          [closeMsg]
        );
      }

      await client.query('COMMIT');

      // 5. Record audit trail
      logAudit({
        userId: user.id,
        action: 'EVENT_PHASE_TRANSITION',
        targetTable: 'event_config',
        targetId: '1',
        details: { from: currentPhase, to: target_phase },
      }).catch(() => {});

      logger.info('Event phase transitioned successfully', {
        from: currentPhase,
        to: target_phase,
        userId: user.id,
      });

      const updated = await getPublicEventConfig();
      return successResponse({
        event_phase: target_phase,
        previous_phase: currentPhase,
        config: updated,
      });
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignored
      }

      // Serialization failure (40001) or deadlock detected (40P01) — retry
      if ((err.code === '40001' || err.code === '40P01') && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 50 + Math.random() * 50;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      logger.error('Phase transition failed', { error: String(err), attempt });
      return Errors.INTERNAL('Failed to transition event phase due to a concurrency error.');
    } finally {
      client.release();
    }
  }

  return Errors.CONFLICT('State transition conflict. Please retry the request.');
}

export const PATCH = withAuth(handleTransition, 'admin');
export const POST = withAuth(handleTransition, 'admin');
