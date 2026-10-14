import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';

/**
 * POST /api/teams/select-problem
 * Allows an authorized team leader to select an official published problem statement
 * strictly within the server-side release window (12:45 PM – 4:00 PM).
 */
export const POST = withAuth(async (req: NextRequest, { user, profile }) => {
  // 1. Team Authorization Check
  if (!profile.team_id) {
    return Errors.FORBIDDEN('You must be a member of a registered team to select a problem statement.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid JSON payload.');
  }

  const { problem_id } = body;
  if (!problem_id) {
    return Errors.BAD_REQUEST('Problem statement ID is required.');
  }

  const cleanProblemId = String(problem_id).trim().toUpperCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Server-side Deadline & Release Window Check
    const { rows: configRows } = await client.query(`
      SELECT problem_statements_published, problem_selection_start, problem_selection_end
      FROM public.event_config
      WHERE id = 1
      FOR SHARE;
    `);

    if (configRows.length === 0 || !configRows[0].problem_statements_published) {
      await client.query('ROLLBACK');
      return Errors.FORBIDDEN('Problem statement selection is currently locked. Awaiting official release.');
    }

    const now = new Date();
    const selectionStart = configRows[0].problem_selection_start ? new Date(configRows[0].problem_selection_start) : null;
    const selectionEnd = configRows[0].problem_selection_end ? new Date(configRows[0].problem_selection_end) : null;

    if (selectionStart && now < selectionStart) {
      await client.query('ROLLBACK');
      return Errors.FORBIDDEN(`Problem selection has not started yet. Opens at ${selectionStart.toLocaleTimeString()}.`);
    }

    if (selectionEnd && now > selectionEnd) {
      await client.query('ROLLBACK');
      return Errors.FORBIDDEN(`Problem statement selection window closed at ${selectionEnd.toLocaleTimeString()}.`);
    }

    // 3. Verify Problem Statement exists and is published
    const { rows: problemRows } = await client.query(`
      SELECT id, title, track
      FROM public.problem_statements
      WHERE id = $1 AND is_published = true
      FOR SHARE;
    `, [cleanProblemId]);

    if (problemRows.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Selected problem statement was not found or is not currently published.');
    }

    // 4. Team Row-Lock & Update (Prevents race conditions)
    const { rows: teamRows } = await client.query(`
      SELECT id, name, selected_problem_id
      FROM public.teams
      WHERE id = $1
      FOR UPDATE;
    `, [profile.team_id]);

    if (teamRows.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Team record not found.');
    }

    // 5. Update team selection
    const { rows: updatedTeam } = await client.query(`
      UPDATE public.teams
      SET
        selected_problem_id = $1,
        problem_selected_at = NOW(),
        track = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, selected_problem_id, problem_selected_at, track;
    `, [cleanProblemId, problemRows[0].track, profile.team_id]);

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'TEAM_PROBLEM_SELECTED',
      targetTable: 'teams',
      targetId: profile.team_id,
      details: {
        team_id: profile.team_id,
        team_name: teamRows[0].name,
        selected_problem_id: cleanProblemId,
        track: problemRows[0].track,
      },
    });

    return successResponse({
      team: updatedTeam[0],
      selectedProblem: {
        id: problemRows[0].id,
        title: problemRows[0].title,
        track: problemRows[0].track,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to select problem statement: ' + err.message);
  } finally {
    client.release();
  }
}, 'participant');
