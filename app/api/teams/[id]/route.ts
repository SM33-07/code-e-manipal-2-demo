import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { getTeamById, updateTeam } from '@/services/teamService';
import { sanitizeString, isValidUUID } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/teams/:id
 * Authenticated — returns details only to team members or admins.
 */
export const GET = withAuth(async (_req, { user, profile, params }) => {
  const id = params?.id;
  try {
    if (!id) return Errors.BAD_REQUEST('Invalid team ID');
    if (!isValidUUID(id)) return Errors.BAD_REQUEST('Invalid team ID');

    if (profile.role !== 'admin') {
      if (profile.role !== 'participant') return Errors.NOT_FOUND('Team');
      const membershipRes = await query(
        'SELECT 1 FROM public.team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1',
        [id, user.id]
      );
      if (membershipRes.rows.length === 0) return Errors.NOT_FOUND('Team');
    }

    const team = await getTeamById(id);

    if (!team) return Errors.NOT_FOUND('Team');

    return successResponse(team);
  } catch (err) {
    logger.error('GET /api/teams/[id]', { error: String(err), id });
    return Errors.INTERNAL();
  }
}, 'participant');

/**
 * PUT /api/teams/:id
 * Authenticated — only the team leader can update the team name.
 *
 * Body: { name: string }
 */
export const PUT = withAuth(async (req, { user, params }) => {
  try {
    const id = params!.id;
    if (!isValidUUID(id)) return Errors.BAD_REQUEST('Invalid team ID');

    // Verify the requester is a leader of this team
    const membershipRes = await query(
      'SELECT role FROM public.team_members WHERE team_id = $1 AND user_id = $2',
      [id, user.id]
    );
    const membership = membershipRes.rows[0];

    if (!membership)               return Errors.FORBIDDEN();
    if (membership.role !== 'leader') return Errors.FORBIDDEN();

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = sanitizeString(body.name, 100);
      if (!name) return Errors.BAD_REQUEST('name must be 1–100 characters');
      updates.name = name;
    }

    if (body.is_locked !== undefined) {
      updates.is_locked = Boolean(body.is_locked);
    }

    if (Object.keys(updates).length === 0) {
      return Errors.BAD_REQUEST('No valid fields to update');
    }

    const team = await updateTeam(id, updates);
    logger.info('PUT /api/teams/[id]', { teamId: id, userId: user.id });
    return successResponse(team);

  } catch (err) {
    logger.error('PUT /api/teams/[id]', { error: String(err) });
    return Errors.INTERNAL();
  }
});

/**
 * DELETE /api/teams/:id
 * Authenticated — only the team leader can disband the team.
 * Only allowed when the leader is the only remaining member.
 */
export const DELETE = withAuth(async (_req, { user, params }) => {
  try {
    const id = params!.id;
    if (!isValidUUID(id)) return Errors.BAD_REQUEST('Invalid team ID');

    // Verify the requester is a leader of this team
    const membershipRes = await query(
      'SELECT role FROM public.team_members WHERE team_id = $1 AND user_id = $2',
      [id, user.id]
    );
    const membership = membershipRes.rows[0];

    if (!membership)               return Errors.FORBIDDEN();
    if (membership.role !== 'leader') return Errors.FORBIDDEN();

    // Count total members
    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM public.team_members WHERE team_id = $1',
      [id]
    );
    const count = countRes.rows[0]?.count ?? 0;

    if (count > 1) {
      return Errors.BAD_REQUEST('Cannot disband team with other members. Remove them first.');
    }

    // Delete the team (cascades to team_members in DB)
    await query('DELETE FROM public.teams WHERE id = $1', [id]);

    logger.info('DELETE /api/teams/[id]', { teamId: id, userId: user.id });
    return successResponse({ disbanded: true });

  } catch (err) {
    logger.error('DELETE /api/teams/[id]', { error: String(err) });
    return Errors.INTERNAL();
  }
});
