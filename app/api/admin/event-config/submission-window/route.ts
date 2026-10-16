import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool, query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import { logAudit } from '@/lib/auth/telemetry';
import { getPublicEventConfig, computeSubmissionWindowStatus } from '@/lib/event/eventConfigHelper';

/**
 * GET /api/admin/event-config/submission-window
 *
 * Admin only — Returns authoritative submission window status, deadline,
 * pause state, and override configuration.
 */
export const GET = withAuth(async () => {
  try {
    const config = await getPublicEventConfig();
    return successResponse(config);
  } catch (err: any) {
    logger.error('GET /api/admin/event-config/submission-window failed', { error: String(err) });
    return Errors.INTERNAL('Failed to fetch submission window status.');
  }
}, 'admin');

/**
 * POST /api/admin/event-config/submission-window
 *
 * Admin only — Authoritative submission window controls:
 * - action: 'open' | 'resume' -> Sets submission_open = true (advances phase from NOT_STARTED to SUBMISSION if needed)
 * - action: 'pause'           -> Sets submission_open = false
 * - action: 'set_deadline'    -> Sets end_time (scheduled deadline) without altering other fields
 * - action: 'set_override'    -> Toggles allow_deadline_override (post-deadline reopening)
 */
export const POST = withAuth(async (req: NextRequest, { user }: { user: any }) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid request body. Expected JSON.');
  }

  const { action, deadline, allow_override, reason } = body;

  if (!action || typeof action !== 'string') {
    return Errors.BAD_REQUEST("Missing required field 'action'. Must be 'open', 'pause', 'resume', 'set_deadline', or 'set_override'.");
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

    // 1. Check whether allow_deadline_override column exists in schema
    const colCheck = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'event_config' AND column_name = 'allow_deadline_override'`
    );
    const hasOverrideCol = colCheck.rows.length > 0;

    // 2. Lock event_config row
    const { rows } = await client.query('SELECT * FROM public.event_config WHERE id = 1 FOR UPDATE');
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Event configuration not found.');
    }
    const current = rows[0];

    let auditAction = '';
    let auditDetails: Record<string, any> = { action, previous_phase: current.event_phase, previous_submission_open: current.submission_open };
    let responseMsg = '';

    switch (action) {
      case 'open':
      case 'resume': {
        const nextPhase = current.event_phase === 'NOT_STARTED' ? 'SUBMISSION' : current.event_phase;
        
        let newEndTime = current.end_time;
        if (deadline) {
          const parsed = new Date(deadline);
          if (isNaN(parsed.getTime())) {
            await client.query('ROLLBACK');
            return Errors.BAD_REQUEST('Invalid deadline timestamp provided.');
          }
          newEndTime = parsed.toISOString();
        }

        await client.query(
          `UPDATE public.event_config SET
             submission_open = TRUE,
             event_phase = $1,
             start_time = COALESCE(start_time, NOW()),
             end_time = $2,
             updated_at = NOW()
           WHERE id = 1`,
          [nextPhase, newEndTime]
        );

        auditAction = action === 'open' ? 'SUBMISSION_WINDOW_OPENED' : 'SUBMISSION_WINDOW_RESUMED';
        auditDetails = { ...auditDetails, new_phase: nextPhase, end_time: newEndTime, submission_open: true };
        responseMsg = 'Submission window opened successfully.';
        break;
      }

      case 'pause': {
        await client.query(
          `UPDATE public.event_config SET
             submission_open = FALSE,
             updated_at = NOW()
           WHERE id = 1`
        );

        auditAction = 'SUBMISSION_WINDOW_PAUSED';
        auditDetails = { ...auditDetails, submission_open: false };
        responseMsg = 'Submission window paused successfully.';
        break;
      }

      case 'set_deadline': {
        if (!deadline) {
          await client.query('ROLLBACK');
          return Errors.BAD_REQUEST("Missing required field 'deadline' for action 'set_deadline'.");
        }
        const parsed = new Date(deadline);
        if (isNaN(parsed.getTime())) {
          await client.query('ROLLBACK');
          return Errors.BAD_REQUEST('Invalid deadline timestamp format.');
        }

        const deadlineIso = parsed.toISOString();
        await client.query(
          `UPDATE public.event_config SET
             end_time = $1,
             updated_at = NOW()
           WHERE id = 1`,
          [deadlineIso]
        );

        auditAction = 'SUBMISSION_DEADLINE_UPDATED';
        auditDetails = { ...auditDetails, previous_deadline: current.end_time, new_deadline: deadlineIso };
        responseMsg = `Submission deadline updated to ${deadlineIso}.`;
        break;
      }

      case 'set_override': {
        const targetOverride = Boolean(allow_override);
        
        if (hasOverrideCol) {
          await client.query(
            `UPDATE public.event_config SET
               allow_deadline_override = $1,
               updated_at = NOW()
             WHERE id = 1`,
            [targetOverride]
          );
        } else {
          // If schema migration has not yet been applied, auto-apply non-destructively
          await client.query(
            `ALTER TABLE public.event_config ADD COLUMN IF NOT EXISTS allow_deadline_override BOOLEAN NOT NULL DEFAULT FALSE`
          );
          await client.query(
            `UPDATE public.event_config SET
               allow_deadline_override = $1,
               updated_at = NOW()
             WHERE id = 1`,
            [targetOverride]
          );
        }

        auditAction = targetOverride ? 'SUBMISSION_DEADLINE_OVERRIDE_ENABLED' : 'SUBMISSION_DEADLINE_OVERRIDE_DISABLED';
        auditDetails = { ...auditDetails, allow_deadline_override: targetOverride, reason: reason || 'Admin override' };
        responseMsg = targetOverride 
          ? 'Post-deadline submission override enabled.' 
          : 'Post-deadline submission override disabled.';
        break;
      }

      default:
        await client.query('ROLLBACK');
        return Errors.BAD_REQUEST(`Unrecognized action '${action}'.`);
    }

    await client.query('COMMIT');

    // 3. Telemetry audit logging
    logAudit({
      userId: user.id,
      action: auditAction,
      targetTable: 'event_config',
      targetId: '1',
      details: auditDetails,
    }).catch(() => {});

    logger.info(`Admin submission-window control executed: ${auditAction}`, { userId: user.id, ...auditDetails });

    const updatedConfig = await getPublicEventConfig();
    return successResponse({
      message: responseMsg,
      action,
      config: updatedConfig,
    });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('POST /api/admin/event-config/submission-window failed', { error: String(err) });
    return Errors.INTERNAL('Failed to update submission window settings.');
  } finally {
    client.release();
  }
}, 'admin');
