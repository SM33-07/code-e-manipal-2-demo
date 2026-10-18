/**
 * POST /api/auth/logout
 *
 * Session Lifecycle — Normal Logout
 *
 * Per Phase 2 specification:
 * - Clears client HTTP-only session cookie
 * - Revokes session in Supabase GoTrue
 * - Records audit log entry
 */

import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { validateCsrf } from '@/lib/auth/csrf';
import { logAudit, extractClientIp } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';
import { successResponse, Errors } from '@/lib/utils/response';
import { revokeTeamSession } from '@/lib/auth/teamSessionLimit';
import { isDemoMode } from '@/lib/demo/demoMode';

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    const res = successResponse({ message: 'Logged out successfully.' });
    res.cookies.set('cem_session_id', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
    });
    return res;
  }

  try {
    // CSRF validation (browser mutation)
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    const supabase = await createSupabaseServerClient();

    // Get current user before signing out (for audit log)
    const { data: { user } } = await supabase.auth.getUser();

    // Revoke session in GoTrue
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.warn('Logout: GoTrue signOut returned error', {
        error: error.message,
        userId: user?.id,
      });
      // Continue anyway — the goal is to clear the session
    }

    // Revoke team session slot if tracked
    const sessionId = req.cookies.get('cem_session_id')?.value || req.headers.get('x-session-id');
    if (sessionId) {
      await revokeTeamSession(sessionId).catch(() => {});
    }

    // Record audit log (non-blocking)
    if (user) {
      logAudit({
        userId: user.id,
        action: 'LOGOUT',
        rawIp: extractClientIp(req.headers),
        rawUserAgent: req.headers.get('user-agent'),
      }).catch(() => {});
    }

    logger.info('Logout successful', { userId: user?.id });

    const res = successResponse({ message: 'Logged out successfully.' });
    res.cookies.set('cem_session_id', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
    });
    return res;
  } catch (err) {
    logger.error('Logout endpoint unexpected error', { error: String(err) });
    return Errors.INTERNAL();
  }
}
