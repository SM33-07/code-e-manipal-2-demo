/**
 * Team Concurrent Session Enforcement Engine
 * File: lib/auth/teamSessionLimit.ts
 *
 * Implements Phase 1 Requirement E:
 * - Hard limit of 5 concurrent active authenticated sessions per team.
 * - Bound to canonical accounts and teams.
 * - Enforces limit atomically via row-level lock (SELECT ... FOR UPDATE) on the team.
 * - Allows reconnect and token refresh reuse of existing session slot.
 * - Rejects 6th session with clear, actionable message (Option B: strict block).
 * - Immediate cleanup of expired or revoked sessions.
 * - Provides explicit authenticated revocation workflows.
 * - Fails closed on database errors.
 */

import { pool, query } from '../db.ts';
import { logger } from '../utils/logger.ts';

export const TEAM_MAX_CONCURRENT_SESSIONS = 5;

export interface RegisterSessionParams {
  sessionId: string;
  teamId: string;
  userId: string;
  ipHash: string;
  userAgentSummary?: string;
  ttlSeconds?: number;
}

export interface RegisterSessionResult {
  allowed: boolean;
  sessionId: string;
  activeCount: number;
  isReconnected: boolean;
  reason?: string;
  message?: string;
}

/**
 * Atomically registers or refreshes a team session under a strict 5-session cap.
 *
 * Concurrency Safety:
 * Uses BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ with SELECT id FROM teams FOR UPDATE.
 * All logins for the same team are strictly serialized. No race condition can exceed 5 slots.
 */
export async function registerTeamSession(
  params: RegisterSessionParams
): Promise<RegisterSessionResult> {
  const {
    sessionId,
    teamId,
    userId,
    ipHash,
    userAgentSummary = 'Unknown Device',
    ttlSeconds = 86400, // 24 hours default
  } = params;

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');

      // 1. Acquire exclusive row-level lock on the team record to serialize concurrent logins
      const { rows: teamRows } = await client.query(
        'SELECT id FROM public.teams WHERE id = $1 FOR UPDATE',
        [teamId]
      );

      if (teamRows.length === 0) {
        await client.query('ROLLBACK');
        return {
          allowed: false,
          sessionId,
          activeCount: 0,
          isReconnected: false,
          reason: 'TEAM_NOT_FOUND',
          message: 'Specified team does not exist.',
        };
      }

      // 2. Clean up expired and revoked sessions for this team
      await client.query(
        `DELETE FROM public.team_active_sessions
         WHERE team_id = $1 AND (expires_at < NOW() OR is_revoked = TRUE)`,
        [teamId]
      );

      // 3. Check if this exact session_id already exists (reconnect / refresh)
      const { rows: existingSession } = await client.query(
        `SELECT session_id, user_id, team_id
         FROM public.team_active_sessions
         WHERE session_id = $1 AND team_id = $2 AND is_revoked = FALSE
         LIMIT 1`,
        [sessionId, teamId]
      );

      if (existingSession.length > 0) {
        // Reconnect or refresh: update activity timestamp without consuming another slot
        await client.query(
          `UPDATE public.team_active_sessions
           SET last_active_at = NOW(),
               expires_at = NOW() + ($1 || ' seconds')::INTERVAL,
               ip_hash = $2,
               user_agent_summary = $3
           WHERE session_id = $4`,
          [ttlSeconds, ipHash, userAgentSummary, sessionId]
        );

        const { rows: countRows } = await client.query(
          `SELECT COUNT(*)::int as count
           FROM public.team_active_sessions
           WHERE team_id = $1 AND is_revoked = FALSE AND expires_at >= NOW()`,
          [teamId]
        );

        await client.query('COMMIT');
        return {
          allowed: true,
          sessionId,
          activeCount: countRows[0].count,
          isReconnected: true,
        };
      }

      // 4. Count current active unrevoked sessions for this team
      const { rows: activeRows } = await client.query(
        `SELECT COUNT(*)::int as count
         FROM public.team_active_sessions
         WHERE team_id = $1 AND is_revoked = FALSE AND expires_at >= NOW()`,
        [teamId]
      );

      const activeCount = activeRows[0].count;

      // 5. Enforce strict cap: if already at maximum, reject the 6th session
      if (activeCount >= TEAM_MAX_CONCURRENT_SESSIONS) {
        await client.query('ROLLBACK');
        logger.warn('Team concurrent session limit reached', {
          teamId,
          userId,
          activeCount,
          maxAllowed: TEAM_MAX_CONCURRENT_SESSIONS,
        });

        return {
          allowed: false,
          sessionId,
          activeCount,
          isReconnected: false,
          reason: 'TEAM_SESSION_LIMIT_EXCEEDED',
          message: `Team session limit reached: A maximum of ${TEAM_MAX_CONCURRENT_SESSIONS} concurrent active sessions are permitted per team. Please sign out from an active device before signing in.`,
        };
      }

      // 6. Slot available: insert new session row
      await client.query(
        `INSERT INTO public.team_active_sessions (
           session_id, team_id, user_id, ip_hash, user_agent_summary, expires_at
         ) VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' seconds')::INTERVAL)`,
        [sessionId, teamId, userId, ipHash, userAgentSummary, ttlSeconds]
      );

      await client.query('COMMIT');

      logger.info('Team session registered successfully', {
        teamId,
        userId,
        activeCount: activeCount + 1,
      });

      return {
        allowed: true,
        sessionId,
        activeCount: activeCount + 1,
        isReconnected: false,
      };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      // Serialization failure (40001) or deadlock (40P01) — retry with backoff
      if ((err.code === '40001' || err.code === '40P01') && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 50) + 20;
        await new Promise((r) => setTimeout(r, jitter * attempt));
        continue;
      }

      logger.error('Database error during team session registration (fail closed)', {
        teamId,
        userId,
        error: String(err),
      });

      return {
        allowed: false,
        sessionId,
        activeCount: 0,
        isReconnected: false,
        reason: 'DB_ERROR',
        message: 'Security session verification temporarily unavailable. Please retry.',
      };
    } finally {
      client.release();
    }
  }

  return {
    allowed: false,
    sessionId,
    activeCount: 0,
    isReconnected: false,
    reason: 'CONCURRENCY_CONFLICT',
    message: 'Concurrent session registration conflict. Please retry.',
  };
}

/**
 * Verifies whether a session ID is active, non-revoked, and unexpired.
 */
export async function verifyTeamSessionActive(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;

  try {
    const { rows } = await query(
      `SELECT is_revoked, (expires_at < NOW()) as is_expired
       FROM public.team_active_sessions
       WHERE session_id = $1
       LIMIT 1`,
      [sessionId]
    );

    if (rows.length === 0) return true; // Session not tracked under team limit (e.g. admin or judge)

    const session = rows[0];
    if (session.is_revoked || session.is_expired) {
      return false;
    }

    return true;
  } catch (err) {
    logger.error('Error verifying team session status (fail closed)', {
      sessionId,
      error: String(err),
    });
    return false; // Fail closed on DB error
  }
}

/**
 * Revokes a single active session by ID.
 */
export async function revokeTeamSession(sessionId: string): Promise<boolean> {
  try {
    const { rowCount } = await query(
      `UPDATE public.team_active_sessions
       SET is_revoked = TRUE, last_active_at = NOW()
       WHERE session_id = $1`,
      [sessionId]
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to revoke team session', { sessionId, error: String(err) });
    return false;
  }
}

/**
 * Revokes all sessions belonging to a specific team (e.g. emergency team lock).
 */
export async function revokeAllTeamSessions(teamId: string): Promise<number> {
  try {
    const { rowCount } = await query(
      `UPDATE public.team_active_sessions
       SET is_revoked = TRUE
       WHERE team_id = $1`,
      [teamId]
    );
    return rowCount ?? 0;
  } catch (err) {
    logger.error('Failed to revoke all team sessions', { teamId, error: String(err) });
    return 0;
  }
}

/**
 * Lists active sessions for a team so members can inspect or revoke devices.
 */
export async function listTeamSessions(teamId: string) {
  const { rows } = await query(
    `SELECT s.session_id, s.user_id, p.name as user_name, p.identifier,
            s.user_agent_summary, s.created_at, s.last_active_at, s.expires_at
     FROM public.team_active_sessions s
     JOIN public.profiles p ON p.id = s.user_id
     WHERE s.team_id = $1 AND s.is_revoked = FALSE AND s.expires_at >= NOW()
     ORDER BY s.last_active_at DESC`,
    [teamId]
  );
  return rows;
}
