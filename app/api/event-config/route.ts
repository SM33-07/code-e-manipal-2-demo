import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import { getPublicEventConfig, getEventConfigState } from '@/lib/event/eventConfigHelper';

/**
 * GET /api/event-config
 *
 * Public — retrieves global hackathon timer, phase, and results publishing status.
 * Strictly read-only: performs ZERO database writes or background mutations.
 * Returns only the strictly allowlisted public fields (ADR-011 / Phase 3).
 */
export async function GET(req: NextRequest) {
  try {
    const publicConfig = await getPublicEventConfig();
    return successResponse(publicConfig);
  } catch (err) {
    logger.error('GET /api/event-config failed', { error: String(err) });
    return Errors.INTERNAL('Failed to fetch event configuration.');
  }
}

/**
 * PATCH /api/event-config
 *
 * Admin only — updates non-phase configuration (timers, buffer duration).
 * 
 * Strict Phase Boundary Invariant:
 * Changing `event_phase` via this endpoint is strictly barred.
 * Phase transitions MUST be requested through:
 * - /api/admin/event-config/transition (standard sequential transitions)
 * - /api/admin/event-config/override-state (emergency audited override)
 */
export const PATCH = withAuth(async (req, { user }) => {
  try {
    const body = await req.json();
    const {
      event_phase,
      hackathon_is_started,
      results_published,
      results_release,
      problem_statements_published,
      start_time,
      end_time,
      buffer_minutes,
      hackathon_start_time,
    } = body;

    // Reject direct event_phase manipulation on this endpoint
    if (event_phase !== undefined || hackathon_is_started !== undefined) {
      return Errors.BAD_REQUEST(
        'Event phase transitions cannot be modified via PATCH /api/event-config. Use /api/admin/event-config/transition for sequential transitions or /api/admin/event-config/override-state for emergency overrides.'
      );
    }

    if (results_release !== undefined || results_published !== undefined) {
      return Errors.BAD_REQUEST(
        'Results publishing state cannot be modified via PATCH /api/event-config. Use POST /api/admin/event-config/publish to initiate results release.'
      );
    }

    if (problem_statements_published !== undefined) {
      return Errors.BAD_REQUEST(
        'Problem-statement publication can only be changed through POST /api/admin/event-config/problem-statements.'
      );
    }

    const parsedStart = start_time || hackathon_start_time;
    const startTimeVal = parsedStart ? new Date(parsedStart).toISOString() : null;
    const endTimeVal = end_time ? new Date(end_time).toISOString() : null;
    const bufferVal = buffer_minutes ? Math.min(Math.max(parseInt(buffer_minutes, 10), 1), 60) : null;

    await query(
      `UPDATE public.event_config SET
         start_time = COALESCE($1, start_time),
         end_time = COALESCE($2, end_time),
         buffer_minutes = COALESCE($3, buffer_minutes),
         updated_at = NOW()
       WHERE id = 1`,
      [startTimeVal, endTimeVal, bufferVal]
    );

    logger.info('PATCH /api/event-config settings updated', {
      userId: user.id,
      start_time: startTimeVal,
      end_time: endTimeVal,
      buffer_minutes: bufferVal,
    });

    const updated = await getPublicEventConfig();
    return successResponse(updated);
  } catch (err) {
    logger.error('PATCH /api/event-config failed', { error: String(err) });
    return Errors.INTERNAL('Failed to update event configuration.');
  }
}, 'admin');
