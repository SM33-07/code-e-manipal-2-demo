import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import {
  createTeam,
  getTeamByUserId,
  joinTeamByInviteCode,
  listAllTeams,
} from '@/services/teamService';
import { sanitizeString } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/teams
 * Authenticated — returns the current user's team with members.
 * Use ?all=true to list all teams.
 */
export const GET = withAuth(async (req, { user, profile }) => {
  try {
    const { searchParams } = new URL(req.url);
    const listAll = searchParams.get('all') === 'true';

    if (listAll) {
      if (profile.role !== 'admin') return Errors.FORBIDDEN();
      const teams = await listAllTeams();
      return successResponse(teams);
    }

    const team = await getTeamByUserId(user.id);

    if (!team) return Errors.NOT_FOUND('Team');

    return successResponse(team);
  } catch (err) {
    logger.error('GET /api/teams', { error: String(err), userId: user.id });
    return Errors.INTERNAL();
  }
});

/**
 * POST /api/teams
 * Authenticated — create a new team OR join via invite code.
 *
 * Body (create): { action: 'create', name: string }
 * Body (join):   { action: 'join',   invite_code: string }
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json();
    const { action } = body;

    // ── Prevent joining/creating a second team ────────────────
    const existingTeam = await getTeamByUserId(user.id);
    if (existingTeam) {
      return Errors.CONFLICT('You are already a member of a team');
    }

    // ── Join via invite code ──────────────────────────────────
    if (action === 'join') {
      const invite_code = sanitizeString(body.invite_code, 20)?.trim();
      if (!invite_code) return Errors.BAD_REQUEST('invite_code is required');

      try {
        const team = await joinTeamByInviteCode(invite_code, user.id);
        logger.info('POST /api/teams (join)', { teamId: team.id, userId: user.id });
        return successResponse(team, undefined, 201);
      } catch (e: any) {
        if (e.message === 'INVALID_INVITE_CODE') return Errors.BAD_REQUEST('Invalid invite code');
        if (e.message === 'AMBIGUOUS_INVITE_CODE') return Errors.CONFLICT('Ambiguous invite code. Please contact organizers.');
        if (e.message === 'ALREADY_IN_TEAM')    return Errors.CONFLICT('Already in this team');
        if (e.message === 'TEAM_FULL')          return Errors.BAD_REQUEST('This team is full');
        if (e.message?.includes('duplicate key')) return Errors.CONFLICT('Already in this team');
        throw e;
      }
    }

    // ── Create new team ───────────────────────────────────────
    const name = sanitizeString(body.name, 100);
    if (!name) return Errors.BAD_REQUEST('name must be 1–100 characters');

    const leaderName = sanitizeString(body.leader_name, 100) || undefined;

    const team = await createTeam(name, user.id, leaderName);
    logger.info('POST /api/teams (create)', { teamId: team.id, userId: user.id });
    return successResponse(team, undefined, 201);

  } catch (err) {
    logger.error('POST /api/teams', { error: String(err) });
    return Errors.INTERNAL();
  }
});

