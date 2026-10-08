import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import { logAudit } from '@/lib/auth/telemetry';
import { isValidPhase, EventPhase } from '@/lib/event/state-machine';
import { getPublicEventConfig } from '@/lib/event/eventConfigHelper';

/**
 * PATCH /api/admin/event-config/override-state
 * (also accepts POST)
 *
 * Admin only — Emergency audited backward or forced event phase transition.
 *
 * Invariants:
 * 1. Requires mandatory non-empty reason (minimum 10 characters).
 * 2. Target phase must be a valid EventPhase.
 * 3. Logged immediately to append-only audit_logs.
 * 4. If regressing from RESULTS to an earlier phase (e.g. JUDGING), atomically resets:
 *    results_release = 'DRAFT', publish_at = NULL, active_release_id = NULL.
 * 5. CRITICAL INVARIANT: Forcing event_phase into RESULTS permits operational movement,
 *    but does NOT publish results or bypass the judging completion gate on POST /publish.
 */
async function handleOverride(req: NextRequest, { user }: { user: any }) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid request body.');
  }

  const { target_phase, reason } = body;

  // 1. Mandatory reason validation
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return Errors.BAD_REQUEST(
      'Emergency state override requires a detailed reason (minimum 10 characters).'
    );
  }

  // 2. Target phase validation
  if (!target_phase || !isValidPhase(target_phase)) {
    return Errors.BAD_REQUEST(
      'Invalid target_phase. Must be one of: NOT_STARTED, HACKING, SUBMISSION, SUBMISSION_CLOSED, JUDGING, RESULTS, ENDED.'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const { rows } = await client.query(
      'SELECT event_phase, results_release, active_release_id FROM public.event_config WHERE id = 1 FOR UPDATE'
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Event configuration not found.');
    }

    const currentPhase: EventPhase = rows[0].event_phase;
    const currentRelease = rows[0].results_release;
    const currentReleaseId = rows[0].active_release_id;

    // 3. Handle state rollback from RESULTS
    // If moving backward from RESULTS to an earlier phase (e.g. JUDGING), reset release state
    const isRegressionFromResults = currentPhase === 'RESULTS' && target_phase !== 'RESULTS' && target_phase !== 'ENDED';

    let newRelease = currentRelease;

    if (isRegressionFromResults) {
      newRelease = 'DRAFT';
      await client.query(
        `UPDATE public.event_config SET
           event_phase = $1,
           results_release = 'DRAFT',
           publish_at = NULL,
           active_release_id = NULL,
           updated_at = NOW()
         WHERE id = 1`,
        [target_phase]
      );
    } else {
      await client.query(
        `UPDATE public.event_config SET
           event_phase = $1,
           updated_at = NOW()
         WHERE id = 1`,
        [target_phase]
      );
    }

    await client.query('COMMIT');

    // 4. Append-only audit logging
    logAudit({
      userId: user.id,
      action: 'EMERGENCY_STATE_OVERRIDE',
      targetTable: 'event_config',
      targetId: '1',
      details: {
        from: currentPhase,
        to: target_phase,
        reason: reason.trim(),
        previousRelease: currentRelease,
        newRelease,
        previousReleaseId: currentReleaseId,
        resetRelease: isRegressionFromResults,
      },
    }).catch(() => {});

    logger.warn('Emergency state override executed', {
      userId: user.id,
      from: currentPhase,
      to: target_phase,
      reason: reason.trim(),
    });

    const updated = await getPublicEventConfig();
    return successResponse({
      event_phase: target_phase,
      previous_phase: currentPhase,
      reason: reason.trim(),
      results_release: newRelease,
      config: updated,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignored
    }
    logger.error('Emergency state override failed', { error: String(err) });
    return Errors.INTERNAL('Failed to execute emergency state override.');
  } finally {
    client.release();
  }
}

export const PATCH = withAuth(handleOverride, 'admin');
export const POST = withAuth(handleOverride, 'admin');
