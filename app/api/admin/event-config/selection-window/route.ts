import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';

/**
 * PUT /api/admin/event-config/selection-window
 * Updates the configurable problem-statement release and selection deadline.
 */
export const PUT = withAuth(async (req: NextRequest, { user }) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid JSON payload.');
  }

  const { selection_start, selection_end } = body;

  if (!selection_start || !selection_end) {
    return Errors.BAD_REQUEST('Both selection_start and selection_end timestamps are required.');
  }

  const startDate = new Date(selection_start);
  const endDate = new Date(selection_end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return Errors.BAD_REQUEST('Invalid ISO date string provided.');
  }

  if (startDate >= endDate) {
    return Errors.BAD_REQUEST('Selection start must be before selection deadline.');
  }

  const { rows } = await pool.query(`
    UPDATE public.event_config
    SET
      problem_selection_start = $1,
      problem_selection_end = $2,
      updated_at = NOW()
    WHERE id = 1
    RETURNING problem_selection_start, problem_selection_end;
  `, [startDate.toISOString(), endDate.toISOString()]);

  logAudit({
    userId: user.id,
    action: 'SELECTION_WINDOW_UPDATED',
    targetTable: 'event_config',
    targetId: '1',
    details: { selection_start, selection_end },
  });

  return successResponse({
    selectionStart: rows[0].problem_selection_start,
    selectionEnd: rows[0].problem_selection_end,
  });
}, 'admin');
