import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/admin/teams
 * Admin only — list all teams with freeze and extension settings.
 */
export const GET = withAuth(async (req) => {
  try {
    const { rows } = await query(
      `SELECT t.*, 
              (SELECT COUNT(*)::int FROM public.team_members tm WHERE tm.team_id = t.id) AS member_count,
              (SELECT s.submitted_at FROM public.submissions s WHERE s.team_id = t.id AND s.deleted_at IS NULL ORDER BY s.submitted_at DESC LIMIT 1) AS submitted_at
       FROM public.teams t 
       ORDER BY t.created_at DESC`
    );
    return successResponse(rows);
  } catch (err) {
    logger.error('GET /api/admin/teams', { error: String(err) });
    return Errors.INTERNAL('Failed to fetch teams list.');
  }
}, 'admin');

/**
 * PATCH /api/admin/teams
 * Admin only — toggle freeze status or set extension for a team (or globally).
 *
 * Body: 
 *   For single team: { id: string, submission_frozen?: boolean, deadline_extension?: string | null }
 *   For global update: { global: true, submission_frozen: boolean }
 */
export const PATCH = withAuth(async (req) => {
  try {
    const body = await req.json();
    const { id, submission_frozen, deadline_extension, global } = body;

    if (global) {
      if (typeof submission_frozen !== 'boolean') {
        return Errors.BAD_REQUEST('submission_frozen boolean is required for global toggle');
      }
      
      await query('UPDATE public.event_config SET global_freeze = $1, updated_at = NOW() WHERE id = 1', [submission_frozen]);
      await query('UPDATE public.teams SET submission_frozen = $1', [submission_frozen]);
      logger.info('Global submission freeze status updated', { submission_frozen });
      return successResponse({ success: true, global: true, submission_frozen });
    }

    if (!id) {
      return Errors.BAD_REQUEST('Team ID is required');
    }

    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (typeof submission_frozen === 'boolean') {
      updates.push(`submission_frozen = $${paramIndex++}`);
      params.push(submission_frozen);
    }

    if (deadline_extension !== undefined) {
      updates.push(`deadline_extension = $${paramIndex++}`);
      params.push(deadline_extension ? new Date(deadline_extension) : null);
    }

    if (updates.length === 0) {
      return Errors.BAD_REQUEST('No updates specified');
    }

    const sql = `UPDATE public.teams SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await query(sql, params);
    const updatedTeam = rows[0];

    if (!updatedTeam) {
      return Errors.NOT_FOUND('Team not found');
    }

    logger.info('Team deadline/freeze status updated', { teamId: id, submission_frozen, deadline_extension });
    return successResponse(updatedTeam);
  } catch (err) {
    logger.error('PATCH /api/admin/teams', { error: String(err) });
    return Errors.INTERNAL('Failed to update team settings.');
  }
}, 'admin');
