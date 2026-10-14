import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { getUserTeamId } from '@/services/submissionService';
import {
  listTeamSessions,
  revokeTeamSession,
  revokeAllTeamSessions,
  TEAM_MAX_CONCURRENT_SESSIONS,
} from '@/lib/auth/teamSessionLimit';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/auth/sessions
 * Returns the current team's active sessions and slot capacity.
 */
export const GET = withAuth(async (req, { user, profile }) => {
  try {
    const teamId = await getUserTeamId(user.id);
    if (!teamId) {
      return successResponse({ sessions: [], active_count: 0, max_allowed: TEAM_MAX_CONCURRENT_SESSIONS });
    }

    const sessions = await listTeamSessions(teamId);
    const currentSessionId = req.cookies.get('cem_session_id')?.value || req.headers.get('x-session-id');

    const mapped = sessions.map((s: any) => ({
      session_id: s.session_id,
      user_id: s.user_id,
      user_name: s.user_name,
      identifier: s.identifier,
      user_agent_summary: s.user_agent_summary,
      created_at: s.created_at,
      last_active_at: s.last_active_at,
      expires_at: s.expires_at,
      is_current: s.session_id === currentSessionId,
    }));

    return successResponse({
      sessions: mapped,
      active_count: mapped.length,
      max_allowed: TEAM_MAX_CONCURRENT_SESSIONS,
    });
  } catch (err) {
    logger.error('GET /api/auth/sessions failed', { error: String(err), userId: user.id });
    return Errors.INTERNAL();
  }
});

/**
 * DELETE /api/auth/sessions
 * Explicitly terminates an existing session or all sessions for the caller's team.
 * Body: { session_id?: string, all?: boolean }
 */
export const DELETE = withAuth(async (req, { user, profile }) => {
  try {
    const teamId = await getUserTeamId(user.id);
    if (!teamId) {
      return Errors.FORBIDDEN('You must belong to a team to manage team sessions.');
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Allow query parameter fallback
    }

    const { searchParams } = req.nextUrl;
    const targetSessionId = body.session_id || searchParams.get('session_id');
    const revokeAll = body.all === true || searchParams.get('all') === 'true';

    if (revokeAll) {
      const revokedCount = await revokeAllTeamSessions(teamId);
      logger.info('All team sessions revoked', { teamId, userId: user.id, revokedCount });
      return successResponse({ message: `Successfully revoked ${revokedCount} active team sessions.` });
    }

    if (!targetSessionId) {
      return Errors.BAD_REQUEST('session_id is required to revoke a specific session.');
    }

    // Verify targetSessionId belongs to caller's team
    const teamSessions = await listTeamSessions(teamId);
    const exists = teamSessions.some((s: any) => s.session_id === targetSessionId);
    if (!exists) {
      return Errors.NOT_FOUND('Session');
    }

    await revokeTeamSession(targetSessionId);
    logger.info('Team session revoked explicitly', { teamId, userId: user.id, sessionId: targetSessionId });

    return successResponse({ message: 'Session revoked successfully.' });
  } catch (err) {
    logger.error('DELETE /api/auth/sessions failed', { error: String(err), userId: user.id });
    return Errors.INTERNAL();
  }
});
