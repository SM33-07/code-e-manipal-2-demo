import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { getTeamMembers, removeTeamMember } from '@/services/teamService';
import { isValidUUID } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';

type Ctx = { params: { id: string } };

/**
 * GET /api/teams/:id/members
 * Authenticated — lists members only for team members or admins.
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

    const members = await getTeamMembers(id);

    return successResponse(members);
  } catch (err) {
    logger.error('GET /api/teams/[id]/members', { error: String(err), id });
    return Errors.INTERNAL();
  }
}, 'participant');

/**
 * DELETE /api/teams/:id/members
 * Authenticated — remove a member from the team.
 *
 * Rules:
 *  - A user can always remove themselves (leave the team).
 *  - Only the team leader can remove other members.
 *  - The leader cannot remove themselves (transfer first).
 *
 * Body: { target_user_id?: string }  — omit to remove self
 */
export const DELETE = withAuth(async (req, { user, params }) => {
  try {
    const teamId = params!.id;
    if (!isValidUUID(teamId)) return Errors.BAD_REQUEST('Invalid team ID');

    const body = await req.json().catch(() => ({}));
    const targetUserId: string = body.target_user_id ?? user.id;

    if (!isValidUUID(targetUserId)) return Errors.BAD_REQUEST('Invalid target_user_id');

    // Fetch the requester's membership
    const myMembershipRes = await query(
      'SELECT role FROM public.team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, user.id]
    );
    const myMembership = myMembershipRes.rows[0];

    if (!myMembership) return Errors.FORBIDDEN();

    const isSelf   = targetUserId === user.id;
    const isLeader = myMembership.role === 'leader';

    // Leaders cannot remove themselves — they must transfer leadership first
    if (isSelf && isLeader) {
      return Errors.BAD_REQUEST(
        'Team leader cannot leave without transferring leadership first'
      );
    }

    // Only leaders can remove others
    if (!isSelf && !isLeader) return Errors.FORBIDDEN();

    // Verify target is actually in the team
    const targetMembershipRes = await query(
      'SELECT role FROM public.team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, targetUserId]
    );
    const targetMembership = targetMembershipRes.rows[0];

    if (!targetMembership) return Errors.NOT_FOUND('Team member');

    await removeTeamMember(teamId, targetUserId);

    logger.info('DELETE /api/teams/[id]/members', {
      teamId,
      removedUserId: targetUserId,
      removedBy:     user.id,
    });

    return successResponse({ removed: true, user_id: targetUserId });

  } catch (err) {
    logger.error('DELETE /api/teams/[id]/members', { error: String(err) });
    return Errors.INTERNAL();
  }
});
